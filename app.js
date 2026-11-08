(() => {
'use strict';
const $ = s => document.querySelector(s);
const KEY='sef_vault_v1', PREF='sef_prefs', FAIL='sef_fail', AUTOLOCK_MS=5*60*1000;
const TYPES = {
  login:{label:'Lozinka',p:'Lozinke',fields:[['site','Aplikacija / sajt'],['user','Korisničko ime / mejl'],['pass','Šifra','secret'],['url','Link (za ikonu)'],['note','Napomena','area']]},
  email:{label:'Mejl',p:'Mejlovi',fields:[['addr','Mejl adresa'],['pass','Šifra','secret'],['recovery','Mejl za oporavak'],['note','Napomena','area']]},
  card:{label:'Kartica',p:'Kartice',fields:[['holder','Ime na kartici'],['num','Broj kartice','secret'],['exp','Važi do (MM/GG)'],['cvv','CVV','secret'],['pin','PIN','secret'],['bank','Banka']]},
  doc:{label:'Dokument',p:'Dokumenti',fields:[['kind','Vrsta (pasoš, vozačka…)'],['number','Broj','secret'],['holder','Vlasnik'],['note','Napomena','area']]},
  sub:{label:'Pretplata',p:'Pretplate',fields:[['service','Servis'],['price','Cijena'],['cycle','Period (mjesečno / godišnje)'],['note','Napomena','area']]},
  person:{label:'Osoba',p:'Imenik',fields:[['bday','Rođendan (GGGG-MM-DD)'],['phone','Telefon'],['mail','Mejl'],['allergy','Alergije'],['sizes','Veličine (odjeća, obuća…)'],['gifts','Ideje za poklon','area'],['note','Napomena','area']]},
  ice:{label:'Hitni slučaj',p:'Hitni slučaj',fields:[['fullname','Ime i prezime'],['blood','Krvna grupa'],['allergy','Alergije'],['meds','Lijekovi / bolesti','area'],['c1n','Kontakt 1 – ime'],['c1p','Kontakt 1 – telefon'],['c2n','Kontakt 2 – ime'],['c2p','Kontakt 2 – telefon'],['doc','Doktor / bolnica']]},
  wifi:{label:'Wi-Fi',p:'Wi-Fi',fields:[['ssid','Naziv mreže'],['pass','Šifra','secret'],['sec','Zaštita (WPA2…)']]},
  codes:{label:'Rezervni kodovi',p:'Rezervni kodovi',fields:[['service','Servis'],['codes','Kodovi (jedan po redu)','area']]},
  qa:{label:'Sig. pitanja',p:'Sigurnosna pitanja',fields:[['service','Servis'],['q1','Pitanje 1'],['a1','Odgovor 1','secret'],['q2','Pitanje 2'],['a2','Odgovor 2','secret']]},
  note:{label:'Bilješka',p:'Bilješke',fields:[['text','Tekst','area']]}
};
const SECRET=['pass','num','cvv','pin','a1','a2','codes','number'];
const COLORS=['','#4fd1b0','#6ea8fe','#b794f6','#f6a35c','#ef6f9a','#e2c044','#8fb3c9','#7bd88f'];
const THEMES=[['auto','Automatska'],['dark','Tamna'],['light','Svijetla'],['midnight','Ponoć'],['paper','Papir'],['forest','Šuma'],['ocean','Okean'],['dusk','Sumrak']];
const COL={login:'#4fd1b0',email:'#6ea8fe',card:'#f6a35c',wifi:'#b794f6',codes:'#ef6f9a',qa:'#e2c044',note:'#8fb3c9',doc:'#5fb4ff',sub:'#ff8fa3',person:'#ffb86b',ice:'#ff5c5c',trash:'#ef6f6c'};
const IC={all:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
login:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',email:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
card:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',wifi:'<path d="M2 9a15 15 0 0120 0M5.5 12.5a10 10 0 0113 0M9 16a5 5 0 016 0"/><circle cx="12" cy="19" r="1"/>',
codes:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',qa:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>',
note:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>',doc:'<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M8 17h8"/>',sub:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',person:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 11a3 3 0 100-6M18 14c2.2.5 3.5 2.4 3.5 5"/>',ice:'<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/><path d="M12 9v5M9.5 11.5h5"/>',trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'};
const ic=k=>`<svg class="ic" viewBox="0 0 24 24">${IC[k]}</svg>`;
const NAMES={};
let key=null,salt=null,tomb={},entries=[],cat='all',editing=null,cur={att:[],h:[],color:''},timer,panelId=null,animateNext=true;
let prefs=JSON.parse(localStorage.getItem(PREF)||'{}');
const pwnCache=new Map();
const LOG='sef_log';
const getLog=()=>JSON.parse(localStorage.getItem(LOG)||'[]');
function logEv(k){localStorage.setItem(LOG,JSON.stringify([{t:Date.now(),k},...getLog()].slice(0,40)))}
const byPin=(a,b)=>(a.pinOrder??1e9)-(b.pinOrder??1e9)||a.title.localeCompare(b.title,'bs');
function pinToggle(e){touch(e);if(e.pin)e.pin=false;else{e.pin=true;e.pinOrder=Math.max(-1,...entries.filter(x=>x.pin&&x!==e).map(x=>x.pinOrder??0))+1}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const reduced=()=>matchMedia('(prefers-reduced-motion:reduce)').matches;
const VERSION='2.1';
const CHANGELOG=[
 {v:'2.1',d:'07.11.2026',t:'Novi izgled unosa i jednostavnije postavke',i:['Svaki unos ima svoju kartičnu naslovnicu s bojom, uzorkom i ikonom prema vrsti','Automatsko prepoznavanje poznatih servisa (streaming, mreže, banke, igre…) s njihovom bojom i ikonom','Postavke su pojednostavljene (prekidači, brzi izbori), a podaci i izvoz prebačeni u Alate','Sortiranje, grupisanje i tema su na brzom dohvatu pored pretrage','Dnevnik promjena „Šta je novo“']},
 {v:'2.0',d:'07.11.2026',t:'Računi i prijava s bilo kojeg uređaja',i:['Registracija i prijava, sinhronizacija između uređaja i dvostepena prijava','Mapa povezanosti, vremenska linija rokova, vođena promjena šifre','Putni mod, hitna kartica za novčanik, imenik, dokumenti i pretplate','Skeniranje kartice kamerom, pravila za jaku glavnu šifru','Zaštita privatnosti: zaključavanje pri napuštanju prozora, trostruki Esc']},
 {v:'1.3',d:'06.11.2026',t:'fara Trezor i brže korištenje',i:['Novo ime i logo, nove teme (Okean, Sumrak)','Brze komande (Ctrl+K), red „Nedavno“, poništavanje brisanja','Prilagođen raspored za sve telefone, tablete i monitore','Donja traka na telefonu i okrugli dugme „+“']},
 {v:'1.2',d:'06.11.2026',t:'Teme, kartice i izvoz',i:['Prikaz kartica ili liste, emoji i boja po unosu, fiksirani unosi „Najčešće“','Panel s detaljima, provjera procurenih šifri (Have I Been Pwned)','Izvoz u PDF (sve ili odabrano), brzi pregled kartice, dnevnik aktivnosti','Teme: Ponoć, Papir, Šuma i animacije']},
 {v:'1.1',d:'05.11.2026',t:'Sigurnost i red',i:['Sigurnosni pregled (slabe, duplirane, stare šifre)','Kanta za smeće (30 dana), historija šifre, prilozi (slike)','Zaključavanje nakon pogrešnih pokušaja, uvoz iz CSV-a']},
 {v:'1.0',d:'05.11.2026',t:'Prvo izdanje',i:['Šifrovani trezor (AES-256) za lozinke, mejlove, kartice i bilješke','Generator šifri, backup, automatsko zaključavanje']}
];
const TPREV={auto:['#0a1017','#4fd1b0'],dark:['#0a1017','#4fd1b0'],light:['#eaf0f5','#0f9f80'],midnight:['#000000','#4fd1b0'],paper:['#f2ebdf','#b5651d'],forest:['#0b1410','#7bd88f'],ocean:['#07131f','#38bdf8'],dusk:['#120d1f','#b794f6']};
Object.assign(IC,{
 play:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',camera:'<rect x="3" y="6" width="18" height="14" rx="3"/><circle cx="12" cy="13" r="3.5"/><path d="M8 6l1.5-2h5L16 6"/>',
 chat:'<path d="M4 5h16v11H9l-5 4z"/>',send:'<path d="M21 3L3 10.5l6.5 2.5L12 20z"/><path d="M9.5 13L21 3"/>',bag:'<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
 bank:'<path d="M3 9l9-5 9 5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/>',music:'<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
 cloud:'<path d="M7 18a4.5 4.5 0 01-.5-9A6 6 0 0118 10a4 4 0 010 8z"/>',game:'<rect x="2.5" y="8" width="19" height="9.5" rx="4.5"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="12" r=".9"/><circle cx="18.5" cy="14" r=".9"/>',
 brief:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 13h18"/>',code:'<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 5l-4 14"/>',
 car:'<path d="M4 16v-4l2-5h12l2 5v4M4 16h16M4 16v2h3v-2M17 16v2h3v-2"/><circle cx="8" cy="13" r=".9"/><circle cx="16" cy="13" r=".9"/>',plane:'<path d="M3 13l18-9-5 17-4-7z"/><path d="M12 14l4-5"/>',
 heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>',user:'<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'
});
/* prepoznavanje servisa: [regex, vrsta, ikona, boja] */
const BR=[
 ['netflix','Streaming','play','#e50914'],['youtube','Video','play','#ff0000'],['twitch','Streaming','play','#9146ff'],['disney|hbo|hulu|prime video|apple tv|crunchyroll','Streaming','play','#4a5de0'],
 ['spotify','Muzika','music','#1db954'],['deezer|apple music|tidal|soundcloud','Muzika','music','#a238ff'],
 ['instagram','Društvena mreža','camera','#e1306c'],['snapchat','Društvena mreža','camera','#f7e400'],['pinterest','Društvena mreža','camera','#e60023'],
 ['facebook|\\bfb\\b|\\bmeta\\b','Društvena mreža','user','#1877f2'],['twitter|\\bx\\.com','Društvena mreža','chat','#1d9bf0'],['reddit','Društvena mreža','chat','#ff4500'],['tiktok','Video','music','#fe2c55'],['tinder|badoo|bumble','Upoznavanje','heart','#fe3c72'],
 ['whatsapp','Poruke','chat','#25d366'],['viber','Poruke','chat','#7360f2'],['messenger|signal','Poruke','chat','#0a7cff'],['telegram','Poruke','send','#2aabee'],['discord','Poruke','chat','#5865f2'],['slack','Posao','chat','#4a154b'],
 ['linkedin','Posao','brief','#0a66c2'],['zoom|teams|webex','Posao','brief','#2d8cff'],['notion|trello|asana|jira|atlassian|figma|canva|adobe','Posao','brief','#7c5cff'],
 ['github|gitlab|bitbucket','Kod','code','#6e5494'],
 ['gmail|googlemail','Mejl','mail','#ea4335'],['outlook|hotmail|live\\.com|msn','Mejl','mail','#0078d4'],['yahoo','Mejl','mail','#6001d2'],['proton','Mejl','shield','#6d4aff'],
 ['google','Google','user','#4285f4'],['microsoft|office365|onedrive','Microsoft','cloud','#0078d4'],['icloud|apple','Apple','cloud','#6e6e73'],['dropbox|mega\\.|cloud','Oblak','cloud','#0061ff'],
 ['xbox','Igre','game','#107c10'],['steam','Igre','game','#1b2838'],['epic games|\\bepic\\b','Igre','game','#2f2f35'],['playstation|\\bpsn\\b|nintendo|fortnite|riot|blizzard|ubisoft|battle\\.net|\\bea\\b','Igre','game','#2563eb'],
 ['amazon','Kupovina','bag','#ff9900'],['ebay|aliexpress|olx|etsy|temu|shein|zalando|wish','Kupovina','bag','#e53238'],
 ['paypal','Plaćanje','bank','#003087'],['revolut|wise|payoneer|stripe|skrill|binance|coinbase|kraken|crypto','Finansije','bank','#0075eb'],
 ['banka|bank|raiffeisen|unicredit|nlb|sparkasse|intesa|addiko|\\basa\\b|erste|sber|n26|hypo','Banka','bank','#0e8a6a'],
 ['booking|airbnb|expedia|ryanair|wizz|airline|flight|trivago|skyscanner','Putovanje','plane','#0b5ed7'],['uber|bolt|taxi','Prevoz','car','#2b2f36'],
 ['vpn|nord|surfshark','Sigurnost','codes','#4687ff'],['osiguranj|insurance|polis','Osiguranje','codes','#2e8b57'],['registracij|vozač|saobra','Vozilo','car','#d97706'],
 ['zdravl|bolnic|ljekar|apotek|health','Zdravlje','heart','#e0405b'],['škol|skol|fakultet|univerz|moodle|coursera|udemy','Obrazovanje','brief','#8b5cf6'],
 ['telekom|bh telecom|m:tel|mtel|haloo|eronet|\\ba1\\b|telenor|vodafone|internet|operator','Telekom','wifi','#0ea5e9']
].map(([re,label,glyph,color])=>({re:new RegExp(re,'i'),label,glyph,color}));
const lumOf=h=>{const n=parseInt(h.slice(1),16);return (0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))/255};
function brandOf(e){
  const f=e.f||{};let m=null;
  if(['login','sub','email'].includes(e.type)){const hay=[e.title,f.site,f.url,f.service,f.addr,f.user].filter(Boolean).join(' ').toLowerCase();m=BR.find(b=>b.re.test(hay))||null}
  return {known:!!m,label:m?m.label:TYPES[e.type].label,glyph:m?m.glyph:e.type,color:m?m.color:COL[e.type]};
}
const ec=e=>e.color||brandOf(e).color;
const grad=c=>`linear-gradient(135deg,${c},color-mix(in srgb,${c} 55%,#000))`;
const inkOf=c=>lumOf(c)>.72?'#111':'#fff';
const svgI=(k,cls)=>`<svg class="ic${cls?' '+cls:''}" viewBox="0 0 24 24">${IC[k]||IC.login}</svg>`;
function glyphHTML(e,b){
  const d=prefs.icons&&!e.emoji?domain(e):'';
  const core=e.emoji?esc(e.emoji):(b.known||e.type!=='login')?svgI(b.glyph):esc(e.title.charAt(0).toUpperCase());
  return core+(d?`<img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64" alt="" loading="lazy">`:'');
}

/* ---------- Crypto ---------- */
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=b=>{let s='';new Uint8Array(b).forEach(x=>s+=String.fromCharCode(x));return btoa(s)};
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const hex=u=>[...u].map(x=>x.toString(16).padStart(2,'0')).join('');
const ITER=250000;
/* PBKDF2 -> 64 bajta: prvih 32 = ključ za šifrovanje (ostaje na uređaju), drugih 32 = "auth" (šalje se serveru) */
async function derive(pw,saltB64){
  const base=await crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']);
  const bits=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(saltB64),iterations:ITER,hash:'SHA-256'},base,512));
  return {key:await crypto.subtle.importKey('raw',bits.slice(0,32),'AES-GCM',false,['encrypt','decrypt']),auth:hex(bits.slice(32))};
}
const payload=()=>({v:2,entries,tomb});
const normalize=p=>Array.isArray(p)?{entries:p,tomb:{}}:{entries:p.entries||[],tomb:p.tomb||{}};
async function encrypt(d){const iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(d)));
  return {salt:salt,iv:b64(iv),data:b64(ct)}}
async function decrypt(st,k){const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(st.iv)},k,unb64(st.data));return JSON.parse(dec.decode(pt))}
async function saveLocal(){
  try{localStorage.setItem(KEY,JSON.stringify(await encrypt(payload())))}
  catch{toast('Nema dovoljno prostora u browseru – obriši neki prilog')}
}
let chg=0;
async function save(){await saveLocal();if(acct){chg++;localStorage.setItem(DIRTY,'1');clearTimeout(syncT);syncT=setTimeout(()=>syncNow(false),1200)}}
const touch=e=>{e.mod=Date.now()};
const purgeIds=ids=>{ids.forEach(id=>tomb[id]=Date.now());entries=entries.filter(e=>!ids.includes(e.id))};
const live=()=>entries.filter(e=>!e.deleted&&(!prefs.travel||e.trip));

/* ---------- Prefs ---------- */
function storePrefs(){localStorage.setItem(PREF,JSON.stringify(prefs))}
function applyPrefs(){
  const r=document.documentElement,st=r.style;
  if(prefs.theme&&prefs.theme!=='auto')r.dataset.theme=prefs.theme;else delete r.dataset.theme;
  if(prefs.accent){st.setProperty('--accent',prefs.accent);st.setProperty('--accent-ink','#06141a')}
  else{st.removeProperty('--accent');st.removeProperty('--accent-ink')}
  $('#optIcons').checked=!!prefs.icons;
  $('#themes').innerHTML=THEMES.map(([k,l])=>{const p=TPREV[k];return `<button type="button" data-t="${k}" class="thm ${(prefs.theme||'auto')===k?'on':''}" style="--bg:${p[0]};--ac:${p[1]}"><i></i><span>${l}</span></button>`}).join('');
  $('#swatches').innerHTML=swatches(prefs.accent||'');
  $('#vGrid').classList.toggle('on',prefs.view!=='list');$('#vList').classList.toggle('on',prefs.view==='list');
  $('#nameIn').value=prefs.name||'';segs();setNewDot();
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
$('#nameIn').oninput=e=>{prefs.name=e.target.value.trim();storePrefs();render()};
$('#optBlur').onchange=e=>{prefs.blur=e.target.checked;savePrefs()};
$('#optNoCap').onchange=e=>{prefs.nocap=e.target.checked;savePrefs()};

/* ---------- Auth: lock screen, accounts, sync ---------- */
const ACC='sef_account',TOK='sef_token',SV='sef_sv',DIRTY='sef_dirty',APIB='sef_api';
let acct=JSON.parse(localStorage.getItem(ACC)||'null'),token=localStorage.getItem(TOK),sv=+(localStorage.getItem(SV)||0);
let srvInfo={},sessAuth=null,syncing=false,syncState=acct?'offline':'off',syncT,serverUp=false,lockMode='login',need2fa=false,lastLogin=null;
const persistAcct=()=>{acct?localStorage.setItem(ACC,JSON.stringify(acct)):localStorage.removeItem(ACC);token?localStorage.setItem(TOK,token):localStorage.removeItem(TOK);localStorage.setItem(SV,String(sv))};
const apiBase=()=>(localStorage.getItem(APIB)||window.FARA_API||'').replace(/\/+$/,'');
async function api(path,method='GET',body){
  try{
    const r=await fetch(apiBase()+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
    let j={};try{j=await r.json()}catch{}
    return {...j,ok:r.ok,status:r.status};
  }catch{return {ok:false,status:0,error:'Nema veze sa serverom.'}}
}
const SYNC={off:['Šifrovano · samo ovaj uređaj',''],ok:['Sinhronizovano ✓','ok'],busy:['Sinhronizujem…','busy'],offline:['Offline · čeka sinhronizaciju','warn'],err:['Greška sinhronizacije','bad']};
function setSync(st){syncState=st;const p=$('#syncPill');if(p){p.className='enc '+SYNC[st][1];p.querySelector('span').textContent=(acct&&st!=='off'?'☁ ':'')+SYNC[st][0]}if(key)paintHero()}
async function probe(){const r=await api('/api/health');serverUp=r.status===200&&!!r.ok;srvInfo=r;paintLock()}

/* password policy: min 12, veliko, malo, broj, znak */
const POLICY=[['Najmanje 12 znakova',p=>p.length>=12],['Veliko slovo',p=>/\p{Lu}/u.test(p)],['Malo slovo',p=>/\p{Ll}/u.test(p)],['Broj',p=>/\d/.test(p)],['Poseban znak (!@#$…)',p=>/[^\p{L}\d\s]/u.test(p)]];
const policyOk=p=>p.length<=128&&POLICY.every(r=>r[1](p));
const paintPolicy=(el,p)=>{el.innerHTML=POLICY.map(([l,f])=>`<li class="${f(p)?'ok':''}">${l}</li>`).join('')};
$('#master').addEventListener('input',()=>paintPolicy($('#policy'),$('#master').value));
$('#pwNew').addEventListener('input',()=>paintPolicy($('#pwPolicy'),$('#pwNew').value));

const stored=()=>JSON.parse(localStorage.getItem(KEY)||'null');
const fails=()=>JSON.parse(localStorage.getItem(FAIL)||'{"n":0,"until":0}');
function setupLock(){
  const has=!!stored();
  if(has)lockMode='unlock';else if(lockMode==='unlock')lockMode='login';
  $('#authApi').value=localStorage.getItem(APIB)||'';
  paintLock();
}
function paintLock(){
  const m=lockMode,has=!!stored(),reg=m==='register',loc=m==='local',unl=m==='unlock';
  $('#authTabs').classList.toggle('hidden',has);
  document.querySelectorAll('#authTabs button').forEach(b=>b.classList.toggle('on',b.dataset.m===m));
  $('#authUser').classList.toggle('hidden',unl||loc);
  $('#master2').classList.toggle('hidden',!(reg||loc));
  $('#policy').classList.toggle('hidden',!(reg||loc));
  $('#adv').classList.toggle('hidden',unl||loc);
  $('#authTotp').classList.toggle('hidden',!need2fa);
  $('#lockHint').classList.toggle('hidden',!(reg||loc));
  const T={unlock:[acct?'Dobrodošao nazad':'Otključaj trezor',acct?acct.u:'Unesi glavnu šifru.'],login:['Prijava','Prijavi se sa bilo kojeg uređaja.'],
    register:['Napravi račun','Trezor se šifruje na tvom uređaju. Server nikad ne vidi tvoju šifru ni podatke.'],local:['Lokalni trezor','Podaci ostaju samo na ovom uređaju.']}[m];
  $('#lockTitle').textContent=T[0];$('#lockSub').textContent=T[1];
  $('#lockBtn').textContent=need2fa?'Potvrdi kod':{unlock:'Otključaj',login:'Prijavi se',register:'Napravi račun',local:'Napravi trezor'}[m];
  $('#srvNote').textContent=(!has&&(reg||m==='login')&&!serverUp)?'Server nije dostupan. Za račune pokreni „node server.js“ ili izaberi „Samo ovaj uređaj“.':'';
  paintPolicy($('#policy'),$('#master').value);
}
$('#authTabs').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;lockMode=b.dataset.m;need2fa=false;$('#lockMsg').textContent='';paintLock()});
$('#authApi').addEventListener('change',e=>{const v=e.target.value.trim();v?localStorage.setItem(APIB,v):localStorage.removeItem(APIB);probe()});
const shake=()=>{const c=$('.lock-card');c.classList.remove('shake');void c.offsetWidth;c.classList.add('shake')};

async function doLocalCreate(pw){
  salt=b64(crypto.getRandomValues(new Uint8Array(16)));key=(await derive(pw,salt)).key;entries=[];tomb={};await saveLocal();
}
async function doRegister(u,pw){
  const sl=b64(crypto.getRandomValues(new Uint8Array(16))),d=await derive(pw,sl);
  key=d.key;salt=sl;entries=[];tomb={};
  const r=await api('/api/register','POST',{u,salt:sl,auth:d.auth,blob:await encrypt(payload()),invite:$('#authInvite').value.trim()});
  if(!r.ok){key=null;throw new Error(r.error||'Registracija nije uspjela.')}
  acct={u:u.trim().toLowerCase(),salt:sl};token=r.token;sv=r.version;sessAuth=d.auth;persistAcct();await saveLocal();
}
async function doRemoteLogin(u,pw,code){
  const pl=await api('/api/prelogin?u='+encodeURIComponent(u));
  if(!pl.salt)throw new Error(pl.error||'Server nije dostupan.');
  const d=await derive(pw,pl.salt);
  const body={u,auth:d.auth};if(code){/^\d{6}$/.test(code.replace(/\s/g,''))?body.totp=code:body.recovery=code}
  const r=await api('/api/login','POST',body);
  if(r.need2fa)return {need2fa:true};
  if(!r.ok)throw new Error(r.error||'Prijava nije uspjela.');
  let p;try{p=normalize(await decrypt(r.blob,d.key))}catch{throw new Error('Trezor se ne može otključati ovom šifrom.')}
  key=d.key;salt=pl.salt;entries=p.entries;tomb=p.tomb;acct={u:u.trim().toLowerCase(),salt:pl.salt,has2fa:!!r.has2fa};token=r.token;sv=r.version;sessAuth=d.auth;lastLogin=r.last;
  persistAcct();await saveLocal();return {ok:true};
}
async function doUnlock(pw){
  const st=stored(),sl=acct?acct.salt:st.salt,d=await derive(pw,sl);
  let p;try{p=normalize(await decrypt(st,d.key))}catch{throw new Error('wrong')}
  key=d.key;salt=sl;entries=p.entries;tomb=p.tomb;sessAuth=d.auth;
}
$('#lockForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const pw=$('#master').value,msg=$('#lockMsg'),u=$('#authUser').value.trim(),f=fails();msg.textContent='';
  if(lockMode==='unlock'&&Date.now()<f.until)return msg.textContent=`Previše pokušaja. Sačekaj ${Math.ceil((f.until-Date.now())/1000)} s.`;
  const bad=m=>{msg.textContent=m;shake()};
  $('#lockBtn').disabled=true;
  try{
    if(lockMode==='unlock')await doUnlock(pw);
    else if(lockMode==='local'||lockMode==='register'){
      if(lockMode==='register'&&u.length<3)return bad('Upiši e-mail ili korisničko ime (najmanje 3 znaka).');
      if(!policyOk(pw))return bad('Šifra mora imati najmanje 12 znakova, veliko i malo slovo, broj i poseban znak.');
      if(pw!==$('#master2').value)return bad('Šifre se ne poklapaju.');
      lockMode==='local'?await doLocalCreate(pw):await doRegister(u,pw);
    }else{
      if(u.length<3)return bad('Upiši e-mail ili korisničko ime.');
      const r=await doRemoteLogin(u,pw,need2fa?$('#authTotp').value.trim():'');
      if(r.need2fa){need2fa=true;paintLock();$('#authTotp').focus();return}
    }
  }catch(err){
    if(err.message==='wrong'){
      f.n++;if(f.n>=3)f.until=Date.now()+Math.min(300,5*2**(f.n-2))*1000;
      localStorage.setItem(FAIL,JSON.stringify(f));logEv('fail');
      bad(f.n>=3?'Pogrešna šifra. Pauza prije sljedećeg pokušaja.':`Pogrešna šifra (${f.n}/3).`+(acct?' Ako si je promijenio na drugom uređaju, odjavi ovaj uređaj u Postavkama i prijavi se ponovo.':''));
    }else bad(err.message||'Greška.');
    return;
  }finally{$('#lockBtn').disabled=false}
  await enterApp();
});
async function enterApp(){
  localStorage.removeItem(FAIL);need2fa=false;
  {const L0=getLog(),lastOk=L0.find(x=>x.k==='ok'),fs=L0.filter(x=>x.k==='fail'&&(!lastOk||x.t>lastOk.t)).length;logEv('ok');
   const A=$('#alert');A.classList.toggle('hidden',!fs);
   if(fs)A.innerHTML=`<span>⚠ Bilo je ${fs} neuspjelih pokušaja otključavanja od tvog zadnjeg ulaska${lastOk?' ('+new Date(lastOk.t).toLocaleString('bs')+')':''}.</span><button class="btn ghost" data-log>Dnevnik</button><button class="mini" data-x aria-label="Zatvori">✕</button>`;
   if(lastOk)setTimeout(()=>toast('Zadnje otključavanje: '+new Date(lastOk.t).toLocaleString('bs')),900)}
  const cut=Date.now()-30*864e5,old=entries.filter(x=>x.deleted&&x.deleted<cut).map(x=>x.id);
  if(old.length){purgeIds(old);await save()}
  for(const k in tomb)if(Date.now()-tomb[k]>90*864e5)delete tomb[k];
  ['#master','#master2','#authUser','#authTotp'].forEach(i=>$(i).value='');paintPolicy($('#policy'),'');
  cat='all';animateNext=true;tipOff=false;buildNav();render();
  $('#lock').classList.add('leaving');await sleep(reduced()?0:260);
  $('#lock').classList.add('hidden');$('#lock').classList.remove('leaving');
  $('#app').classList.remove('hidden');$('#app').classList.add('appin');
  $('#fab').classList.remove('hidden');resetTimer();
  startSync();
}
function lock(){
  key=null;entries=[];tomb={};sessAuth=null;clearTimeout(timer);clearTimeout(syncT);closePanel();hidePeek();shield(false);$('#alert').classList.add('hidden');
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
  if(e.key==='Escape'){const n=Date.now();escT=escT.filter(t=>n-t<900);escT.push(n);if(escT.length>=3){escT=[];navigator.clipboard&&navigator.clipboard.writeText('').catch(()=>{});lock()}}
});
let escT=[],tipOff=false;

/* ---- sync ---- */
async function relogin(){
  if(!acct||!sessAuth)return false;
  let r=await api('/api/login','POST',{u:acct.u,auth:sessAuth});
  if(r.need2fa){
    const code=await askText('Dvostepena prijava','Unesi šestocifreni kod iz aplikacije (ili kod za oporavak)');
    if(!code)return false;
    r=await api('/api/login','POST',{u:acct.u,auth:sessAuth,...(/^\d{6}$/.test(code.replace(/\s/g,''))?{totp:code}:{recovery:code})});
  }
  if(!r.ok||!r.token)return false;
  token=r.token;persistAcct();return true;
}
async function mergeBlob(blob){
  let R;try{R=normalize(await decrypt(blob,key))}catch{throw 'key'}
  for(const k in R.tomb)tomb[k]=Math.max(tomb[k]||0,R.tomb[k]);
  const map=new Map(),mod=x=>x.mod||x.updated||0;
  for(const e of [...entries,...R.entries]){if(tomb[e.id])continue;const o=map.get(e.id);if(!o||mod(e)>mod(o))map.set(e.id,e)}
  entries=[...map.values()];
}
async function startSync(){
  if(!acct){setSync('off');return}
  setSync('busy');
  if(!token&&!(await relogin())){setSync('offline');return}
  await syncNow(true);
}
async function syncNow(pull){
  if(!acct||!key||syncing)return;
  if(!token&&!(await relogin()))return setSync('offline');
  syncing=true;setSync('busy');
  try{
    let r;
    if(pull){
      r=await api('/api/vault');
      if(r.status===401){if(await relogin())r=await api('/api/vault');else throw 'auth'}
      if(!r.ok)throw 'net';
      if(r.version!==sv){await mergeBlob(r.blob);sv=r.version;await saveLocal();localStorage.setItem(DIRTY,'1');chg++;render()}
    }
    if(localStorage.getItem(DIRTY)){
      for(let i=0;i<4;i++){
        const my=chg;
        r=await api('/api/vault','PUT',{blob:await encrypt(payload()),base:sv});
        if(r.status===401){if(await relogin())continue;throw 'auth'}
        if(r.ok){sv=r.version;if(chg===my)localStorage.removeItem(DIRTY);else{clearTimeout(syncT);syncT=setTimeout(()=>syncNow(false),500)}break}
        if(r.status===409){await mergeBlob(r.blob);sv=r.version;await saveLocal();chg++;render();continue}
        throw 'net';
      }
    }
    persistAcct();setSync('ok');
  }catch(e){
    if(e==='key'){setSync('err');toast('Šifra računa je promijenjena na drugom uređaju. Odjavi ovaj uređaj i prijavi se ponovo.')}
    else setSync(e==='auth'?'err':'offline');
  }finally{syncing=false}
}
window.addEventListener('online',()=>{if(key&&acct)syncNow(true)});
setInterval(()=>{if(key&&acct&&document.hasFocus())syncNow(true)},60000);

/* ---- generic ask dialog ---- */
function askText(title,label,pw){
  return new Promise(res=>{
    $('#askT').textContent=title;$('#askL').textContent=label;const i=$('#askIn');i.type=pw?'password':'text';i.value='';let done=false;
    const fin=v=>{if(done)return;done=true;if($('#askDlg').open)$('#askDlg').close();res(v)};
    $('#askForm').onsubmit=e=>{e.preventDefault();fin(i.value)};$('#askNo').onclick=()=>fin(null);$('#askDlg').onclose=()=>fin(null);
    $('#askDlg').showModal();i.focus();
  });
}
async function verifyPw(pw){
  try{const st=stored(),d=await derive(pw,acct?acct.salt:st.salt);await decrypt(st,d.key);return d}catch{return null}
}

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
  const pw=live().filter(e=>e.f.pass),weak=pw.filter(e=>strength(e.f.pass)<=2),map={};
  pw.forEach(e=>(map[e.f.pass]=map[e.f.pass]||[]).push(e));
  const dups=Object.values(map).filter(g=>g.length>1),lim=Date.now()-365*864e5;
  const old=pw.filter(e=>(e.pwd||e.updated||Date.now())<lim),leaked=pw.filter(e=>pwnCache.get(e.f.pass)>0);
  const bad=new Set([...weak,...dups.flat(),...old,...leaked]);
  return {pw,weak,dups,old,leaked,bad,score:pw.length?Math.round(100*(1-bad.size/pw.length)):100};
}

/* ---------- Render ---------- */
function cardHTML(e,i,inTrash,drag){
  const b=brandOf(e),c=e.color||b.color,ink=inkOf(c),list=prefs.view==='list';
  const star=inTrash?'':`<button class="star${e.pin?' on':''}" data-pin title="${e.pin?'Ukloni iz najčešćih':'Dodaj u najčešće'}" aria-label="Fiksiraj">★</button>`;
  const sk=['pass','num','codes','a1'].find(k=>e.f[k]),uk=e.f.user?'user':e.f.addr?'addr':'';
  const SL={pass:'Kopiraj šifru',num:'Kopiraj broj',codes:'Kopiraj kodove',a1:'Kopiraj odgovor'};
  const chips=inTrash?`<small class="muted">Još ${Math.max(0,30-Math.floor((Date.now()-e.deleted)/864e5))} dana</small><button class="chip" data-restore>Vrati</button><button class="chip danger" data-purge>Briši</button>`
    :(uk?`<button class="chip" data-copy="${uk}">Kopiraj ${uk==='addr'?'mejl':'korisnika'}</button>`:'')+(sk?`<button class="chip" data-copy="${sk}">${SL[sk]}</button>`:'');
  const attrs=`class="item t-${e.type}${list?' row':''}" data-id="${e.id}" tabindex="0"${drag?' draggable="true"':''} style="--c:${c};--g:${grad(c)};--ink:${ink};--i:${Math.min(i,14)}"`;
  const info=`<strong>${esc(e.title)}</strong><span class="sub">${esc(subtitle(e))||'&nbsp;'}</span>`;
  if(list)return `<div ${attrs}><div class="glyph sm">${glyphHTML(e,b)}</div><div class="info">${info}</div><span class="tag">${esc(b.label)}</span><div class="ifoot">${chips}</div>${star}</div>`;
  const cover=e.type==='card'?miniCC(e):`<div class="art" data-t="${e.type}"><div class="glyph">${glyphHTML(e,b)}</div><span class="lab">${esc(b.label)}</span><svg class="wmk" viewBox="0 0 24 24">${IC[b.glyph]||IC.login}</svg></div>`;
  return `<div ${attrs}>${cover}${star}<div class="ibody">${info}<div class="ifoot">${chips}</div></div></div>`;
}
function render(){
  if(!key)return;
  const q=$('#search').value.trim().toLowerCase(),act=live(),tr=prefs.travel?[]:entries.filter(e=>e.deleted),inTrash=cat==='trash';
  $('#c-all').textContent=act.length;$('#c-trash').textContent=tr.length;
  Object.keys(TYPES).forEach(k=>$('#c-'+k).textContent=act.filter(e=>e.type===k).length);
  const an=analyze();
  $('#stTotal').textContent=act.length;$('#stHealth').textContent=an.score+'%';$('#stRing').style.setProperty('--p',an.score);$('#stIssues').textContent=an.bad.size;
  let rows=(inTrash?tr:act.filter(e=>cat==='all'||e.type===cat)).filter(e=>!q||(e.title+' '+Object.entries(e.f).filter(([k])=>!SECRET.includes(k)).map(x=>x[1]).join(' ')).toLowerCase().includes(q));
  rows.sort(prefs.sort==='updated'?(a,b)=>(b.updated||0)-(a.updated||0):(a,b)=>a.title.localeCompare(b.title,'bs'));
  const h=new Date().getHours();
  $('#greet').textContent=cat==='all'?(h<5?'Laku noć':h<12?'Dobro jutro':h<18?'Dobar dan':'Dobro veče')+(prefs.name?', '+prefs.name:''):'';
  $('#heroTitle').textContent=cat==='all'?'Tvoj trezor':NAMES[cat];
  heroBase=rows.length+(rows.length===1?' unos':' unosa')+(q?' pronađeno':'');paintHero();
  $('#stats').classList.toggle('hidden',inTrash);
  $('#tripBar').classList.toggle('hidden',!prefs.travel);
  if(prefs.travel)$('#tripBar').innerHTML=`<span>✈ Putni mod je uključen. Vidiš samo ${act.length} unosa.</span><button class="btn ghost" data-tripoff>Isključi</button>`;
  const tp=!inTrash&&cat==='all'&&!q&&!tipOff?computeTip():null;tipAct=tp?tp.act:null;
  $('#tip').classList.toggle('hidden',!tp);
  if(tp)$('#tip').innerHTML=`<span>${tp.t}</span><button class="btn primary" data-tipact>${tp.btn}</button><button class="mini" data-x aria-label="Zatvori">✕</button>`;
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
  if(e.target.id==='emptyTrash'){if(confirm('Trajno obrisati sve iz kante?')){purgeIds(entries.filter(v=>v.deleted).map(v=>v.id));await save();render()}return}
  const rc=e.target.closest('[data-open]');if(rc)return openPanel(rc.dataset.open);
  const it=e.target.closest('.item');if(!it)return;const id=it.dataset.id,en=entries.find(v=>v.id===id);if(!en)return;
  const cp=e.target.closest('[data-copy]');if(cp)return copy(en.f[cp.dataset.copy]);
  if(e.target.closest('[data-pin]')){pinToggle(en);await save();return render()}
  if(e.target.closest('[data-restore]')){delete en.deleted;touch(en);await save();render();return toast('Vraćeno')}
  if(e.target.closest('[data-purge]')){if(confirm('Trajno obrisati ovaj unos? Ovo se ne može poništiti.')){purgeIds([id]);await save();render()}return}
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
  $('#panelBody').innerHTML=`<div class="phead art-big" data-t="${e.type}" style="--g:${grad(ec(e))};--ink:${inkOf(ec(e))}"><div class="glyph lg">${glyphHTML(e,brandOf(e))}</div>
    <div><h2>${esc(e.title)}</h2><span class="tag2">${esc(brandOf(e).label)}</span></div><button class="mini x" data-act="close" aria-label="Zatvori">✕</button></div>
    <div class="pscroll">${e.type==='card'?cardVisual(e):''}${e.pin?'<div class="mvrow"><span class="muted small">Redoslijed u „Najčešće“</span><button class="mini" data-act="mvl">← Naprijed</button><button class="mini" data-act="mvr">Nazad →</button></div>':''}${rows||'<p class="muted">Nema unesenih podataka.</p>'}${metaRows(e)}${atts}${hist}<p class="muted small" style="margin-top:16px">Izmijenjeno ${e.updated?fmt(e.updated):'–'}</p></div>
    <div class="pfoot"><button class="btn primary" data-act="edit">Uredi</button><button class="btn ghost" data-act="dup">Dupliraj</button>${e.f.pass?'<button class="btn ghost" data-act="wiz">Promijeni šifru</button>':''}<button class="btn ghost" data-act="pdf">PDF</button><button class="btn ghost" data-act="pin">${e.pin?'★ Ukloni':'☆ Fiksiraj'}</button><button class="btn danger" data-act="del">Obriši</button></div>`;
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
  if(a==='wiz')return openWiz(e.id);
  if(a==='pdf')await downloadPdf([e],'fara-trezor-'+slug(e.title)+'.pdf',{});
  if(a==='dup'){const c=JSON.parse(JSON.stringify(e));Object.assign(c,{id:crypto.randomUUID(),title:e.title+' (kopija)',h:[],pin:false,pinOrder:undefined,updated:Date.now(),mod:Date.now(),pwd:Date.now()});
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
  e.deleted=Date.now();touch(e);await save();await flyToTrash(id);render();
  toast('Premješteno u kantu','Poništi',async()=>{delete e.deleted;touch(e);await save();render()});
}

/* ---------- Strength / HIBP ---------- */
function updateMeter(){
  const inp=$('#fields [data-k="pass"]'),box=$('#meter');
  if(!inp||!inp.value){box.classList.add('hidden');return}
  box.classList.remove('hidden');
  const v=inp.value,s=strength(v),lvl=s<=2?['Slaba','var(--danger)']:s<=4?['Srednja','#e2c044']:['Jaka','var(--accent)'];
  const bar=box.querySelector('i');bar.style.width=Math.max(12,s/6*100)+'%';bar.style.background=lvl[1];
  const dup=live().filter(x=>x!==editing&&x.f.pass===v).map(x=>x.title);
  $('#mtxt').textContent='Jačina: '+lvl[0]+' · probijanje ≈ '+crackTime(v)+(dup.length?` · ⚠ ista šifra se koristi i za: ${dup.slice(0,3).join(', ')}`:'');
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
$('#attBtn').onclick=()=>{pauseAway(90000);$('#attFile').click()};
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
function openEntry(id,preset){
  editing=id?entries.find(e=>e.id===id):null;
  cur={att:editing?[...(editing.att||[])]:[],h:editing?[...(editing.h||[])]:[],color:editing?editing.color||'':''};
  $('#dlgTitle').textContent=editing?'Uredi unos':'Novi unos';
  $('#type').value=editing?editing.type:(preset||(TYPES[cat]?cat:'login'));$('#type').disabled=!!editing;
  $('#title').value=editing?editing.title:'';$('#emoji').value=editing?editing.emoji||'':'';
  $('#ecolors').innerHTML=swatches(cur.color);
  buildFields($('#type').value,editing?editing.f:{});
  $('#delBtn').classList.toggle('hidden',!editing);
  $('#due').value=editing?editing.due||'':'';$('#rep').value=editing?editing.rep||'':'';fillLink(editing?editing.link:'');typeUI();
  renderHist();renderAtts();$('#dlg').showModal();
}
$('#type').onchange=()=>{buildFields($('#type').value);typeUI()};
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
    Object.assign(editing,{title,f,emoji,color,due:$('#due').value,rep:$('#rep').value,link:$('#link').value,att:cur.att,h:cur.h.slice(0,10),updated:Date.now(),mod:Date.now()});
  }else entries.push({id:crypto.randomUUID(),type:$('#type').value,title,f,emoji,color,due:$('#due').value,rep:$('#rep').value,link:$('#link').value,att:cur.att,h:[],updated:Date.now(),mod:Date.now(),pwd:Date.now()});
  await save();$('#dlg').close();render();toast('Sačuvano');
});
$('#delBtn').onclick=()=>{if(editing)trashEntry(editing.id)};

/* ---------- Generator ---------- */
function genPass(n=16,sym=true){
  const set='abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'+(sym?'!@#$%^&*-_=+?':'');
  return Array.from(crypto.getRandomValues(new Uint32Array(n)),v=>set[v%set.length]).join('');
}
const newGen=()=>{const v=$('#genOut').value=genPass(+$('#len').value,$('#optSym').checked),s=strength(v),b=$('#genBar');b.style.width=Math.max(12,s/6*100)+'%';b.style.background=s<=2?'var(--danger)':s<=4?'#e2c044':'var(--accent)'};
function openGen(){newGen();$('#genDlg').showModal()}
$('#len').oninput=()=>{$('#lenVal').textContent=$('#len').value;newGen()};
$('#optSym').onchange=newGen;$('#genNew').onclick=newGen;
$('#genCopy').onclick=()=>copy($('#genOut').value);$('#genClose').onclick=()=>$('#genDlg').close();

/* ---------- Security review ---------- */
function renderSec(){
  const {pw,weak,dups,old,leaked,score}=analyze();
  const row=(e,d)=>`<div class="srow"><span><b>${esc(e.title)}</b><small>${esc(d)}</small></span><button class="mini" data-open="${e.id}">Otvori</button>${e.f.pass?`<button class="mini" data-wiz="${e.id}">Promijeni</button>`:''}</div>`;
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
  const w=e.target.closest('[data-wiz]');if(w){$('#secDlg').close();return openWiz(w.dataset.wiz)}
  const o=e.target.closest('[data-open]');if(o){$('#secDlg').close();return openPanel(o.dataset.open)}
  const b=e.target.closest('[data-pwnall]');if(!b)return;
  const list=[...new Set(live().filter(x=>x.f.pass).map(x=>x.f.pass))].filter(p=>!pwnCache.has(p));
  let i=0,fail=false;
  for(const p of list){b.disabled=true;b.textContent=`Provjeravam ${++i}/${list.length}…`;if(await pwned(p)===null){fail=true;break}await sleep(120)}
  renderSec();render();toast(fail?'Provjera prekinuta – nema interneta?':'Provjera gotova');
});

/* ---------- Settings, backup, PDF, CSV ---------- */
$('#setBtn').onclick=()=>{applyPrefs();$('#sDlg').showModal()};
$('#sClose').onclick=()=>$('#sDlg').close();
$('#pwBtn').onclick=()=>{$('#pwForm').reset();$('#pwMsg').textContent='';paintPolicy($('#pwPolicy'),'');$('#pwDlg').showModal()};
$('#pwCancel').onclick=()=>$('#pwDlg').close();
$('#pwForm').addEventListener('submit',async e=>{
  e.preventDefault();const msg=$('#pwMsg'),n=$('#pwNew').value;msg.textContent='';
  const old=await verifyPw($('#pwOld').value);if(!old)return msg.textContent='Trenutna šifra nije tačna.';
  if(!policyOk(n))return msg.textContent='Nova šifra mora imati najmanje 12 znakova, veliko i malo slovo, broj i poseban znak.';
  if(n!==$('#pwNew2').value)return msg.textContent='Nove šifre se ne poklapaju.';
  const nsalt=b64(crypto.getRandomValues(new Uint8Array(16))),nd=await derive(n,nsalt);
  if(acct){
    const pk=key,ps=salt;key=nd.key;salt=nsalt;
    const r=await api('/api/password','POST',{auth:old.auth,newAuth:nd.auth,newSalt:nsalt,blob:await encrypt(payload())});
    if(!r.ok){key=pk;salt=ps;return msg.textContent=r.error||'Promjena nije uspjela (treba internet veza).'}
    acct.salt=nsalt;sv=r.version;sessAuth=nd.auth;persistAcct();await saveLocal();localStorage.removeItem(DIRTY);
  }else{key=nd.key;salt=nsalt;sessAuth=nd.auth;await saveLocal()}
  $('#pwDlg').close();toast('Glavna šifra je promijenjena');
});
function download(blob,name){const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:name});document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
function exportBackup(){
  download(new Blob([localStorage.getItem(KEY)],{type:'application/json'}),'fara-trezor-backup-'+new Date().toISOString().slice(0,10)+'.json');
  prefs.lastBackup=Date.now();storePrefs();render();toast('Šifrovani backup preuzet');
}
$('#importFile').onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const st=JSON.parse(await file.text()),pw=await askText('Uvoz backupa','Glavna šifra ovog backupa',true);if(pw===null)return;
    const d=await derive(pw,st.salt),data=normalize(await decrypt(st,d.key));
    if(!confirm(`Ovo zamjenjuje trenutnih ${live().length} unosa sa ${data.entries.length} iz backupa. Nastaviti?`))return;
    entries=data.entries;entries.forEach(x=>{touch(x);delete tomb[x.id]});for(const k in data.tomb)if(!entries.some(x=>x.id===k))tomb[k]=Math.max(tomb[k]||0,data.tomb[k]);
    await save();render();toast('Backup uvezen');
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
  if(document.querySelector('input[name=pdfmode]:checked').value==='all')return live();
  const ids=new Set([...document.querySelectorAll('#pdfPick .pitem input:checked')].map(i=>i.value));
  return live().filter(e=>ids.has(e.id));
}
function buildPick(){
  $('#pdfPick').innerHTML=Object.keys(TYPES).map(k=>{
    const l=live().filter(e=>e.type===k).sort((a,b)=>a.title.localeCompare(b.title,'bs'));
    return l.length?`<div class="pgrp"><span style="color:${COL[k]}">${TYPES[k].p} (${l.length})</span><input type="checkbox" data-grp="${k}" aria-label="Sve u grupi" checked></div>`+l.map(e=>`<label class="pitem"><input type="checkbox" value="${e.id}" data-t="${k}" checked> ${esc(e.emoji||'')} ${esc(e.title)}</label>`).join(''):'';
  }).join('');
}
function pdfCount(){
  const pick=document.querySelector('input[name=pdfmode]:checked').value==='pick';
  $('#pdfPick').classList.toggle('hidden',!pick);
  const n=pickedEntries().length;$('#pdfCount').textContent=n+(n===1?' unos':' unosa');$('#pdfGo').disabled=!n;
}
function openPdfDlg(){buildPick();document.querySelector('input[name=pdfmode][value=all]').checked=true;$('#pdfSep').checked=false;pdfCount();$('#pdfDlg').showModal();ensurePdf()}
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
    entries.push({id:crypto.randomUUID(),type:isNote?'note':'login',title,f,emoji:'',color:'',att:[],h:[],updated:Date.now(),mod:Date.now(),pwd:Date.now()});added++;
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
  p.splice(b,0,p.splice(a,1)[0]);p.forEach((x,n)=>{x.pinOrder=n;touch(x)});
}
function movePin(id,d){
  const p=entries.filter(x=>x.pin&&!x.deleted).sort(byPin),i=p.findIndex(x=>x.id===id),j=i+d;if(i<0||j<0||j>=p.length)return;
  [p[i],p[j]]=[p[j],p[i]];p.forEach((x,n)=>{x.pinOrder=n;touch(x)});
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
let awayT,awayOn=false,pauseUntil=0,holdUntil=0,altDown=false;
const pauseAway=ms=>{pauseUntil=Date.now()+ms};
const lockSecs=()=>prefs.lockHidden===undefined?30:prefs.lockHidden;
function away(){
  if(!key||awayOn||Date.now()<pauseUntil)return;awayOn=true;
  if(prefs.blur!==false)shield(true);
  const sec=lockSecs();if(sec>=0){clearTimeout(awayT);awayT=setTimeout(()=>{if(key&&(document.hidden||!document.hasFocus()))lock()},sec*1000)}
}
function back(){awayOn=false;clearTimeout(awayT);if(Date.now()>holdUntil&&!altDown)shield(false)}
window.addEventListener('blur',away);
window.addEventListener('focus',()=>{altDown=false;back()});
document.addEventListener('visibilitychange',()=>document.hidden?away():back());
window.addEventListener('pagehide',()=>{if(key&&lockSecs()===0)lock()});
setInterval(()=>{if(!key)return;if(!document.hasFocus())away();else if(awayOn)back()},600);
document.addEventListener('keydown',e=>{if(prefs.nocap&&key&&(e.key==='Alt'||e.key==='Meta'||e.key==='OS')){altDown=true;shield(true)}});
document.addEventListener('keyup',e=>{if(e.key==='Alt'||e.key==='Meta'||e.key==='OS'){altDown=false;if(!awayOn)shield(false)}});
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
  const acts=[['Novi unos','Akcija',()=>openEntry()],['Generator šifri','Akcija',openGen],['Sigurnosni pregled','Akcija',()=>$('#secBtn').click()],['Postavke','Akcija',()=>$('#setBtn').click()],['Izvezi u PDF','Akcija',openPdfDlg],['Mapa povezanosti','Alat',showMap],['Vremenska linija','Alat',showTimeline],['Putni mod','Alat',openTrip],['Hitna kartica','Alat',toolIce],['Zaključaj','Akcija',lock],
    ...THEMES.map(([k,l])=>['Tema: '+l,'Tema',()=>{prefs.theme=k;savePrefs()}])];
  const ents=live().map(e=>[e.title,TYPES[e.type].label,()=>openPanel(e.id),e]);
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

/* ---------- Crack time, deadlines, tip ---------- */
function crackTime(p){
  if(!p)return '–';
  let cs=0;if(/[a-z]/.test(p))cs+=26;if(/[A-Z]/.test(p))cs+=26;if(/\d/.test(p))cs+=10;if(/[^\w]/.test(p))cs+=32;
  let bits=p.length*Math.log2(cs||2);if(strength(p)<=2)bits=Math.min(bits,30);
  const s=Math.pow(2,Math.max(0,bits-1))/1e10;
  if(s<1)return 'manje od sekunde';if(s<60)return Math.round(s)+' sekundi';if(s<3600)return Math.round(s/60)+' minuta';
  if(s<86400)return Math.round(s/3600)+' sati';if(s<31557600)return Math.round(s/86400)+' dana';
  const y=s/31557600;if(y<1e3)return Math.round(y)+' godina';if(y<1e6)return Math.round(y/1e3)+' hiljada godina';if(y<1e9)return Math.round(y/1e6)+' miliona godina';
  return 'više od milijardu godina';
}
const today=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const daysTo=d=>Math.round((d-today())/864e5);
const rel=n=>n<0?`isteklo prije ${-n} d`:n===0?'danas':`za ${n} d`;
const urg=n=>n<0?'#ef6f6c':n<=30?'#f6a35c':n<=90?'#e2c044':'#4fd1b0';
function nextDue(e){
  let d=null,rep=e.rep;
  if(e.due)d=new Date(e.due+'T00:00:00');
  else if(e.type==='person'&&/^\d{4}-\d{2}-\d{2}$/.test(e.f.bday||'')){d=new Date(e.f.bday+'T00:00:00');rep='y'}
  else if(e.type==='card'){const m=(e.f.exp||'').match(/^\s*(\d{1,2})\s*[\/\-]\s*(\d{2}|\d{4})\s*$/);if(m){const y=m[2].length===2?2000+ +m[2]:+m[2];d=new Date(y,+m[1],0)}}
  if(!d||isNaN(d))return null;
  const t=today();
  if(rep==='y')while(d<t)d.setFullYear(d.getFullYear()+1);else if(rep==='m')while(d<t)d.setMonth(d.getMonth()+1);
  return d;
}
const dueList=()=>live().map(e=>({e,d:nextDue(e)})).filter(x=>x.d&&daysTo(x.d)<=365&&daysTo(x.d)>=-90).sort((a,b)=>a.d-b.d);
let tipAct=null,heroBase='';
function paintHero(){const h=$('#heroSub');if(h)h.textContent=heroBase+(acct&&key?' · '+SYNC[syncState][0]:'')}
function computeTip(){
  const L=dueList().filter(x=>daysTo(x.d)<=14);
  if(L.length){const x=L[0],n=daysTo(x.d);return {t:`${esc(x.e.title)}: ${n<0?'isteklo prije '+(-n)+' dana':n===0?'rok je danas':'rok za '+n+' dana'}`,btn:'Otvori',act:()=>openPanel(x.e.id)}}
  const old=analyze().old.sort((a,b)=>(a.pwd||a.updated)-(b.pwd||b.updated))[0];
  if(old){const d=Math.floor((Date.now()-(old.pwd||old.updated))/864e5);return {t:`Šifra za ${esc(old.title)} je stara ${d>=365?Math.floor(d/365)+(d>=730?' godine':' godinu'):d+' dana'}.`,btn:'Promijeni šifru',act:()=>openWiz(old.id)}}
  return null;
}
$('#tip').addEventListener('click',e=>{if(e.target.dataset.tipact!==undefined&&tipAct)tipAct();if(e.target.dataset.x!==undefined){tipOff=true;render()}});
$('#tripBar').addEventListener('click',e=>{if(e.target.dataset.tripoff!==undefined)toggleTravelOff()});
function metaRows(e){
  const d=nextDue(e),lk=e.link&&entries.find(x=>x.id===e.link);
  return (d?`<div class="frow"><div class="flab">Rok</div><div class="fval">${d.toLocaleDateString('bs')} <small class="muted">(${rel(daysTo(d))})</small></div></div>`:'')
    +(lk?`<div class="frow"><div class="flab">Pripada mejlu</div><div class="fval">${esc(lk.title)}</div></div>`:'');
}
function fillLink(sel){
  $('#link').innerHTML='<option value="">— nijedan —</option>'+entries.filter(x=>!x.deleted&&x.type==='email'&&x!==editing).map(x=>`<option value="${x.id}">${esc(x.title)}${x.f.addr?' · '+esc(x.f.addr):''}</option>`).join('');
  $('#link').value=sel||'';
}
function typeUI(){const t=$('#type').value;$('#linkWrap').classList.toggle('hidden',t==='email');$('#scanBtn').classList.toggle('hidden',t!=='card')}

/* ---------- Timeline ---------- */
function showTimeline(){
  const L=dueList(),now=new Date(),MN=['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
  const months=Array.from({length:12},(_,i)=>{const d=new Date(now.getFullYear(),now.getMonth()+i,1);return {y:d.getFullYear(),m:d.getMonth(),items:[]}});
  const over=[];
  L.forEach(x=>{const n=daysTo(x.d);if(n<0)return over.push(x);const M=months.find(M=>M.y===x.d.getFullYear()&&M.m===x.d.getMonth());if(M)M.items.push(x)});
  const row=x=>{const n=daysTo(x.d);return `<div class="tlrow" style="--c:${urg(n)}"><span class="tld"></span><div><b>${esc(x.e.title)}</b><small>${x.d.toLocaleDateString('bs')} · ${rel(n)} · ${TYPES[x.e.type].label}</small></div><button class="mini" data-open="${x.e.id}">Otvori</button></div>`};
  const strip=months.map(M=>{const w=M.items.length?Math.min(...M.items.map(x=>daysTo(x.d))):null;return `<div class="tlm" style="--c:${w===null?'var(--line)':urg(w)}"><b>${MN[M.m]}</b><i>${M.items.length||''}</i></div>`}).join('');
  const subs=live().filter(e=>e.type==='sub').reduce((s,e)=>{const p=parseFloat((e.f.price||'').replace(',','.'))||0;return s+(/god/i.test(e.f.cycle||'')?p/12:p)},0);
  $('#tlBody').innerHTML=`<div class="tlstrip">${strip}</div>`
    +(over.length?`<h3 class="tlh" style="color:var(--danger)">Isteklo</h3>${over.map(row).join('')}`:'')
    +months.filter(M=>M.items.length).map(M=>`<h3 class="tlh">${new Date(M.y,M.m,1).toLocaleDateString('bs',{month:'long',year:'numeric'})}</h3>${M.items.map(row).join('')}`).join('')
    +(!L.length?'<p class="muted">Ništa ne ističe u narednih godinu dana. Dodaj „Ističe / podsjetnik“ unosima (pasoš, osiguranje, registracija, pretplata), a rok kartice i rođendane osoba uzimam sam.</p>':'')
    +(subs?`<div class="tlsum">Pretplate: ≈ ${subs.toFixed(2)} mjesečno</div>`:'');
  $('#tlDlg').showModal();
}
$('#tlBody').addEventListener('click',e=>{const b=e.target.closest('[data-open]');if(b){$('#tlDlg').close();openPanel(b.dataset.open)}});
$('#tlClose').onclick=()=>$('#tlDlg').close();

/* ---------- Connection map ---------- */
function buildGraph(){
  const act=live(),emails=act.filter(e=>e.type==='email'),byAddr=new Map();
  emails.forEach(e=>{const a=(e.f.addr||'').trim().toLowerCase();if(a)byAddr.set(a,e)});
  const edges=[],hasMail=id=>emails.some(x=>x.id===id);
  act.forEach(e=>{
    if(e.type==='email'){const r=(e.f.recovery||'').trim().toLowerCase(),h=r&&byAddr.get(r);if(h&&h.id!==e.id)edges.push([h.id,e.id]);if(e.link&&e.link!==e.id&&hasMail(e.link))edges.push([e.link,e.id]);return}
    const u=((e.f.user||e.f.addr||e.f.mail||'')+'').trim().toLowerCase(),hs=new Set();
    if(byAddr.has(u))hs.add(byAddr.get(u).id);if(e.link&&hasMail(e.link))hs.add(e.link);
    hs.forEach(h=>edges.push([h,e.id]));
  });
  const kids=new Map();edges.forEach(([a,b])=>{if(!kids.has(a))kids.set(a,[]);kids.get(a).push(b)});
  const reach=id=>{const seen=new Set(),st=[id];while(st.length){const x=st.pop();(kids.get(x)||[]).forEach(k=>{if(!seen.has(k)&&k!==id){seen.add(k);st.push(k)}})}return seen};
  const hubs=[...kids.keys()].map(id=>({e:act.find(x=>x.id===id),set:reach(id)})).filter(h=>h.e).sort((a,b)=>b.set.size-a.set.size);
  const linked=new Set(edges.map(x=>x[1]));
  return {act,edges,hubs,orphans:act.filter(e=>e.type==='login'&&!linked.has(e.id)),emails};
}
function showMap(){
  const g=buildGraph();let html='';
  if(!g.emails.length)html='<p class="muted">Dodaj barem jedan unos tipa „Mejl“. Računi se povezuju sami ako im je korisničko ime isto kao mejl adresa, ili ručno u polju „Pripada mejlu“.</p>';
  else if(!g.hubs.length)html='<p class="muted">Još nema veza. Upiši mejl adresu kao korisničko ime u računima, ili u unosu izaberi „Pripada mejlu“.</p>';
  else{
    const hubIds=g.hubs.map(h=>h.e.id),kidIds=[...new Set(g.edges.map(x=>x[1]))],name=id=>g.act.find(x=>x.id===id);
    const RH=44,H=Math.max(hubIds.length,kidIds.length)*RH+20,yH=i=>10+i*RH+(Math.max(hubIds.length,kidIds.length)-hubIds.length)*RH/2,yK=i=>10+i*RH+(Math.max(hubIds.length,kidIds.length)-kidIds.length)*RH/2;
    const col=n=>n>=5?'#ef6f6c':n>=2?'#f6a35c':'#4fd1b0',cut=s=>esc(s.length>24?s.slice(0,23)+'…':s);
    const paths=g.edges.map(([a,b])=>{const i=hubIds.indexOf(a),j=kidIds.indexOf(b);if(i<0||j<0)return '';const y1=yH(i)+17,y2=yK(j)+17;return `<path class="edge" d="M244,${y1} C292,${y1} 292,${y2} 340,${y2}"/>`}).join('');
    const hubN=g.hubs.map((h,i)=>`<g class="nd" data-id="${h.e.id}"><rect x="14" y="${yH(i)}" width="230" height="34" rx="10" fill="color-mix(in srgb,${col(h.set.size)} 16%,var(--panel))" stroke="${col(h.set.size)}" stroke-width="1.5"/><text x="26" y="${yH(i)+21}">${cut(h.e.title)}</text><text x="232" y="${yH(i)+21}" text-anchor="end" style="fill:${col(h.set.size)}">${h.set.size}</text></g>`).join('');
    const kidN=kidIds.map((id,i)=>{const e=name(id);return e?`<g class="nd" data-id="${id}"><rect x="340" y="${yK(i)}" width="246" height="34" rx="10" fill="var(--panel)" stroke="${COL[e.type]||'#888'}" stroke-width="1.5"/><text x="352" y="${yK(i)+21}">${cut(e.title)}</text></g>`:''}).join('');
    html=`<div class="mapwrap"><svg viewBox="0 0 600 ${H}" role="img" aria-label="Mapa povezanosti">${paths}${hubN}${kidN}</svg></div>`
      +g.hubs.map(h=>{const n=h.set.size,names=[...h.set].map(id=>name(id)).filter(Boolean).map(x=>esc(x.title));
        return `<div class="risk" style="--c:${col(n)}"><div><b>${esc(h.e.title)}</b><small>Ako izgubiš ovaj mejl, gubiš ${n} ${n===1?'račun':'računa'}: ${names.slice(0,6).join(', ')}${names.length>6?'…':''}</small></div><span class="rbadge">${n}</span><button class="mini" data-open="${h.e.id}">Otvori</button></div>`}).join('');
  }
  if(g.orphans.length)html+=`<p class="muted small" style="margin-top:14px">${g.orphans.length} ${g.orphans.length===1?'račun nema':'računa nema'} povezan mejl. Otvori unos i izaberi „Pripada mejlu“ da se pojavi na mapi.</p>`;
  $('#mapBody').innerHTML=html;$('#mapDlg').showModal();
}
$('#mapBody').addEventListener('click',e=>{const n=e.target.closest('[data-id],[data-open]');if(n){$('#mapDlg').close();openPanel(n.dataset.id||n.dataset.open)}});
$('#mapClose').onclick=()=>$('#mapDlg').close();

/* ---------- Guided password change ---------- */
let wiz=null;
function openWiz(id){const e=entries.find(x=>x.id===id);if(!e)return;wiz={id,step:0,pw:genPass(20,true)};closePanel();paintWiz();$('#wizDlg').showModal()}
function paintWiz(){
  const e=entries.find(x=>x.id===wiz.id),s=wiz.step,url=safeUrl(e.f.url||e.f.site);
  const body=[
    `<h3>1. Otvori ${esc(e.title)}</h3><p class="muted">Prijavi se i pronađi „Promijeni šifru“ u postavkama naloga.</p>${url?`<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Otvori sajt</a>`:'<p class="muted small">Za ovaj unos nema linka. Otvori sajt sam.</p>'}`,
    `<h3>2. Nova šifra</h3><div class="wizpw">${esc(wiz.pw)}</div><p class="muted small">Procjena probijanja: ${crackTime(wiz.pw)}</p><div class="row"><button class="btn ghost" data-w="regen">Nova</button><button class="btn primary" data-w="copy">Kopiraj</button></div>`,
    `<h3>3. Potvrdi na sajtu</h3><p class="muted">Zalijepi novu šifru na sajtu i sačuvaj promjenu. Tek kad sajt potvrdi, klikni dugme ispod. Stara šifra ostaje sačuvana dok ne potvrdiš.</p>`,
    `<h3>✓ Gotovo</h3><p class="muted">Nova šifra je sačuvana u trezoru, a stara je u historiji šifre.</p>`][s];
  const nav=[`<button class="btn ghost" data-w="cancel">Odustani</button><button class="btn primary" data-w="next">Dalje</button>`,
    `<button class="btn ghost" data-w="back">Nazad</button><button class="btn primary" data-w="copynext">Kopiraj i dalje</button>`,
    `<button class="btn ghost" data-w="back">Nazad</button><button class="btn primary" data-w="done">Promijenio sam šifru</button>`,
    `<button class="btn primary" data-w="cancel">Zatvori</button>`][s];
  $('#wizBody').innerHTML=`<div class="wdots">${[0,1,2,3].map(i=>`<i class="${i<=s?'on':''}"></i>`).join('')}</div>${body}<div class="wnav">${nav}</div>`;
}
$('#wizDlg').addEventListener('click',async ev=>{
  const b=ev.target.closest('[data-w]');if(!b||!wiz)return;const a=b.dataset.w;
  if(a==='cancel'){wiz=null;return $('#wizDlg').close()}
  if(a==='next')wiz.step++;if(a==='back')wiz.step--;
  if(a==='regen')wiz.pw=genPass(20,true);
  if(a==='copy')copy(wiz.pw);
  if(a==='copynext'){copy(wiz.pw);wiz.step++}
  if(a==='done'){
    const e=entries.find(x=>x.id===wiz.id);
    if(e.f.pass){e.h=e.h||[];e.h.unshift({p:e.f.pass,d:Date.now()});e.h=e.h.slice(0,10)}
    e.f.pass=wiz.pw;e.pwd=Date.now();e.updated=Date.now();touch(e);await save();render();wiz.step=3;
  }
  paintWiz();
});

/* ---------- Travel mode ---------- */
function tripCount(){const n=document.querySelectorAll('#tripPick input:checked').length;$('#tripCount').textContent=n+(n===1?' unos':' unosa')}
function openTrip(){
  if(prefs.travel)return toggleTravelOff();
  $('#tripPick').innerHTML=Object.keys(TYPES).map(k=>{
    const l=entries.filter(e=>!e.deleted&&e.type===k).sort((a,b)=>a.title.localeCompare(b.title,'bs'));
    return l.length?`<div class="pgrp"><span style="color:${COL[k]}">${TYPES[k].p}</span></div>`+l.map(e=>`<label class="pitem"><input type="checkbox" value="${e.id}" ${e.trip?'checked':''}> ${esc(e.emoji||'')} ${esc(e.title)}</label>`).join(''):'';
  }).join('')||'<p class="muted">Nema unosa.</p>';
  tripCount();$('#tripDlg').showModal();
}
$('#tripPick').addEventListener('change',tripCount);
$('#tripCancel').onclick=()=>$('#tripDlg').close();
$('#tripGo').onclick=async()=>{
  const ids=new Set([...document.querySelectorAll('#tripPick input:checked')].map(i=>i.value));
  if(!ids.size)return toast('Označi barem jedan unos');
  entries.forEach(e=>{const t=ids.has(e.id);if(!!e.trip!==t){e.trip=t;touch(e)}});
  await save();prefs.travel=true;cat='all';closePanel();$('#tripDlg').close();savePrefs();toast('Putni mod je uključen');
};
async function toggleTravelOff(){
  const pw=await askText('Isključi putni mod','Unesi glavnu šifru',true);if(pw===null)return;
  if(!(await verifyPw(pw)))return toast('Pogrešna šifra');
  prefs.travel=false;savePrefs();toast('Putni mod je isključen');
}

/* ---------- Emergency card ---------- */
async function toolIce(){
  const e=live().find(x=>x.type==='ice');
  if(!e){toast('Prvo napravi unos „Hitni slučaj“');return openEntry(null,'ice')}
  toast('Pripremam karticu…');
  if(!await ensurePdf())return toast('Datoteka pdfmake.bundle.js nije pronađena uz sajt');
  pdfMake.createPdf(window.SefPdf.ice(e)).download('fara-trezor-hitna-kartica.pdf');
}

/* ---------- Camera card scan ---------- */
let scanStream=null;
async function openScan(){
  pauseAway(120000);
  try{scanStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280}},audio:false});$('#scanVid').srcObject=scanStream;$('#scanDlg').showModal()}
  catch{toast('Kamera nije dostupna ili nije dozvoljena u browseru')}
}
function closeScan(){if(scanStream)scanStream.getTracks().forEach(t=>t.stop());scanStream=null;if($('#scanDlg').open)$('#scanDlg').close()}
const luhn=n=>{let s=0,d=false;for(let i=n.length-1;i>=0;i--){let x=+n[i];if(d){x*=2;if(x>9)x-=9}s+=x;d=!d}return s%10===0};
async function snapCard(){
  const v=$('#scanVid');if(!v.videoWidth)return;
  const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);
  let text='';
  if('TextDetector' in window){try{text=(await new TextDetector().detect(c)).map(t=>t.rawValue).join('\n')}catch{}}
  closeScan();
  if(!text.trim()){cur.att.push({name:'kartica.jpg',data:c.toDataURL('image/jpeg',.8)});renderAtts();return toast('Ovaj browser ne čita tekst sa slike. Slika je dodana kao prilog, prepiši podatke ručno.')}
  const nums=(text.replace(/[Oo]/g,'0').match(/\d[\d ]{11,22}\d/g)||[]).map(x=>x.replace(/\s/g,'')).filter(x=>x.length>=13&&x.length<=19&&luhn(x));
  const ex=text.match(/(0[1-9]|1[0-2])\s*[\/\-]\s*(\d{2})\b/);
  const holder=text.split('\n').map(x=>x.trim()).filter(x=>/^[A-ZČĆŽŠĐ .'-]{5,}$/.test(x)&&!/BANK|VISA|MASTER|DEBIT|CREDIT|VALID|THRU/.test(x)).sort((a,b)=>b.length-a.length)[0];
  const set=(k,v)=>{const i=$(`#fields [data-k="${k}"]`);if(i&&v)i.value=v};
  set('num',nums[0]);set('exp',ex&&ex[1]+'/'+ex[2]);set('holder',holder);
  toast(nums[0]||ex?'Podaci su prepisani. Provjeri ih prije snimanja.':'Nisam uspio pročitati karticu. Pokušaj ponovo ili upiši ručno.');
}
$('#scanBtn').onclick=openScan;$('#scanGo').onclick=snapCard;$('#scanNo').onclick=closeScan;$('#scanDlg').addEventListener('close',closeScan);

/* ---------- Account dialog ---------- */
function wipeLocal(){[KEY,ACC,TOK,SV,DIRTY,FAIL].forEach(k=>localStorage.removeItem(k));acct=null;token=null;sv=0;syncState='off'}
function openAcc(){
  $('#accSub').innerHTML='';
  $('#accBody').innerHTML=acct
    ?`<div class="accrow"><b>${esc(acct.u)}</b><small>${SYNC[syncState][0]}${acct.has2fa?' · dvostepena prijava uključena':''}</small></div>
      <div class="stack"><button class="btn ghost" data-acc="sync">Sinhronizuj sada</button><button class="btn ghost" data-acc="2fa">${acct.has2fa?'Isključi':'Uključi'} dvostepenu prijavu…</button>
      <button class="btn ghost" data-acc="dev">Prijavljeni uređaji…</button><button class="btn ghost" data-acc="pw">Promijeni glavnu šifru</button>
      <button class="btn ghost" data-acc="out">Odjava s ovog uređaja</button><button class="btn danger" data-acc="del">Obriši račun</button></div>`
    :`<p class="muted">Trezor trenutno postoji samo na ovom uređaju. Poveži ga s računom da mu možeš pristupiti s bilo kojeg uređaja.</p>
      <label>E-mail ili korisničko ime <input id="linkUser" autocapitalize="off"></label>
      <button class="btn primary" data-acc="link">Poveži trezor s računom</button>
      <p class="muted small" style="margin-top:12px">Treba server (<code>node server.js</code>). Šifra mora imati 12+ znakova, veliko i malo slovo, broj i znak.</p>`;
  $('#accDlg').showModal();
}
$('#accBtn').onclick=()=>{$('#sDlg').close();openAcc()};
$('#accClose').onclick=()=>$('#accDlg').close();
let codesCache=[];
$('#accDlg').addEventListener('click',async e=>{
  const b=e.target.closest('[data-acc],[data-rev]');if(!b)return;
  if(b.dataset.rev!==undefined){await api('/api/sessions/revoke','POST',{id:b.dataset.rev});return accDev()}
  const a=b.dataset.acc;
  if(a==='sync'){await syncNow(true);openAcc()}
  if(a==='pw'){$('#accDlg').close();$('#pwBtn').click()}
  if(a==='link')await linkAccount();
  if(a==='2fa')await acc2fa();
  if(a==='2fa-confirm')await acc2faConfirm();
  if(a==='codes-copy')copy(codesCache.join('\n'));
  if(a==='dev')await accDev();
  if(a==='devall'){const r=await api('/api/sessions');for(const s of r.sessions||[])if(!s.current)await api('/api/sessions/revoke','POST',{id:s.id});accDev()}
  if(a==='out')await accOut();
  if(a==='del')await accDel();
});
async function linkAccount(){
  const u=$('#linkUser').value.trim();if(u.length<3)return toast('Upiši e-mail ili korisničko ime');
  const pw=await askText('Poveži s računom','Unesi trenutnu glavnu šifru',true);if(pw===null)return;
  const d=await verifyPw(pw);if(!d)return toast('Pogrešna šifra');
  if(!policyOk(pw))return toast('Ova šifra ne ispunjava nova pravila. Prvo je promijeni (Promijeni glavnu šifru).');
  const inv=srvInfo.invite?await askText('Kod pozivnice','Unesi kod pozivnice servera'):'';if(inv===null)return;
  const r=await api('/api/register','POST',{u,salt,auth:d.auth,blob:await encrypt(payload()),invite:inv||''});
  if(!r.ok)return toast(r.error||'Povezivanje nije uspjelo');
  acct={u:u.toLowerCase(),salt};token=r.token;sv=r.version;sessAuth=d.auth;persistAcct();setSync('ok');openAcc();toast('Trezor je povezan s računom');
}
async function acc2fa(){
  if(acct.has2fa){
    const pw=await askText('Isključi dvostepenu prijavu','Glavna šifra',true);if(pw===null)return;
    const d=await verifyPw(pw);if(!d)return toast('Pogrešna šifra');
    const code=await askText('Isključi dvostepenu prijavu','Šestocifreni kod iz aplikacije');if(code===null)return;
    const r=await api('/api/2fa/disable','POST',{auth:d.auth,code});if(!r.ok)return toast(r.error||'Nije uspjelo');
    acct.has2fa=false;persistAcct();toast('Dvostepena prijava je isključena');return openAcc();
  }
  const r=await api('/api/2fa/setup','POST',{});if(!r.ok)return toast(r.error||'Nije uspjelo');
  $('#accSub').innerHTML=`<p class="muted small">1. U aplikaciji za autentifikaciju (Google Authenticator, Aegis, 2FAS…) dodaj ovaj ključ ručno:</p><code class="secret">${esc(r.secret)}</code>
    <a class="btn ghost" href="${esc(r.uri)}">Otvori u aplikaciji</a><label style="margin-top:12px">2. Upiši šestocifreni kod<input id="tfCode" inputmode="numeric" autocomplete="off"></label><button class="btn primary" data-acc="2fa-confirm">Uključi</button>`;
}
async function acc2faConfirm(){
  const r=await api('/api/2fa/enable','POST',{code:$('#tfCode').value});if(!r.ok)return toast(r.error||'Neispravan kod');
  acct.has2fa=true;persistAcct();codesCache=r.codes;
  $('#accSub').innerHTML=`<p><b>Sačuvaj kodove za oporavak.</b> Svaki važi jednom, ako izgubiš telefon.</p><div class="codes">${r.codes.map(c=>`<span>${c}</span>`).join('')}</div><button class="btn ghost" data-acc="codes-copy">Kopiraj kodove</button>`;
}
async function accDev(){
  const r=await api('/api/sessions');if(!r.ok)return toast(r.error||'Nije uspjelo');
  $('#accSub').innerHTML=`<h3 style="margin:14px 0 4px;font-size:16px">Prijavljeni uređaji</h3>`+r.sessions.map(s=>`<div class="dev"><span><b>${s.current?'Ovaj uređaj':'Drugi uređaj'}</b><small>${esc(s.ua||'nepoznat browser')}</small><small>Zadnje: ${new Date(s.last).toLocaleString('bs')}</small></span>${s.current?'':`<button class="mini" data-rev="${s.id}">Odjavi</button>`}</div>`).join('')
    +`<button class="btn ghost" style="margin-top:12px" data-acc="devall">Odjavi sve ostale uređaje</button>`;
}
async function accOut(){
  if(!confirm('Odjaviti ovaj uređaj? Lokalna kopija trezora se briše s ovog uređaja, a podaci ostaju na računu.'))return;
  if(localStorage.getItem(DIRTY)){await syncNow(false);if(localStorage.getItem(DIRTY)&&!confirm('Neke promjene nisu sinhronizovane i bit će izgubljene. Nastaviti?'))return}
  await api('/api/logout','POST');wipeLocal();lock();toast('Odjavljen s ovog uređaja');
}
async function accDel(){
  if(!confirm('Trajno obrisati račun i sve podatke sa servera? Ovo se ne može poništiti.'))return;
  const pw=await askText('Obriši račun','Unesi glavnu šifru',true);if(pw===null)return;
  const d=await verifyPw(pw);if(!d)return toast('Pogrešna šifra');
  const r=await api('/api/account','DELETE',{auth:d.auth});if(!r.ok)return toast(r.error||'Brisanje nije uspjelo');
  wipeLocal();lock();toast('Račun je obrisan');
}

/* ---------- Tools dialog ---------- */
$('#toolsBtn').onclick=()=>$('#toolsDlg').showModal();
$('#toolsDlg').addEventListener('click',e=>{
  const b=e.target.closest('[data-tool]');if(!b)return;$('#toolsDlg').close();
  const f={map:showMap,tl:showTimeline,trip:openTrip,ice:toolIce,sec:()=>$('#secBtn').click(),gen:openGen,pdf:openPdfDlg,export:exportBackup,import:()=>{pauseAway(90000);$('#importFile').click()},csv:()=>{pauseAway(90000);$('#csvFile').click()},close:()=>{}}[b.dataset.tool];
  if(f)f();
});


/* ---------- Segmented controls, popovers, changelog ---------- */
function segs(){
  const DEF={sort:'name',group:'none',lockMin:5,lockHidden:30};
  document.querySelectorAll('.segc').forEach(c=>{const k=c.dataset.pref,cur=prefs[k]===undefined?DEF[k]:prefs[k];c.querySelectorAll('button').forEach(b=>b.classList.toggle('on',String(cur)===b.dataset.v))});
}
document.addEventListener('click',e=>{
  const b=e.target.closest('.segc button');
  if(b){const c=b.parentElement,k=c.dataset.pref;prefs[k]=c.hasAttribute('data-num')?+b.dataset.v:b.dataset.v;storePrefs();segs();
    if(k==='sort'||k==='group'){animateNext=true;render()}if(k==='lockMin')resetTimer()}
});
function closePops(){document.querySelectorAll('.pop.open').forEach(p=>p.classList.remove('open'));document.querySelectorAll('.tbtn2.on').forEach(x=>x.classList.remove('on'))}
[['viewBtn','viewPop'],['themeBtn','themePop']].forEach(([bt,pp])=>{$('#'+bt).onclick=e=>{e.stopPropagation();const open=$('#'+pp).classList.contains('open');closePops();if(!open){$('#'+pp).classList.add('open');$('#'+bt).classList.add('on')}}});
document.addEventListener('click',e=>{if(!e.target.closest('.popwrap'))closePops()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePops()});
function setNewDot(){const b=$('#setBtn');if(b)b.classList.toggle('newdot',prefs.seenVer!==VERSION);const p=$('#verPill');if(p)p.textContent='v'+VERSION}
function openChg(){
  $('#chgBody').innerHTML=CHANGELOG.map(c=>`<div class="chg"><div class="chgh"><span class="vpill">v${c.v}</span><b>${esc(c.t)}</b><small>${c.d}</small></div><ul>${c.i.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`).join('');
  prefs.seenVer=VERSION;storePrefs();setNewDot();$('#sDlg').close();$('#chgDlg').showModal();
}
$('#chgBtn').onclick=openChg;$('#chgClose').onclick=()=>$('#chgDlg').close();

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

applyPrefs();setupLock();probe();
})();
