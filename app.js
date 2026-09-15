/* ============================================================
   Хан-Уул дүүрэг — Аж ахуйн нэгжийн бүртгэл (app.js)
   ============================================================ */

/* Өгөгдөл хадгалах давхарга.
   - Claude artifact дотор: window.storage (нийтийн сан)
   - Жирийн сервер/локал файл дээр: localStorage
   Сервер рүү шилжихдээ зөвхөн энэ блокийг API дуудлагаар солино. */
const DBX = (() => {
  if (window.storage && typeof window.storage.get === "function") return window.storage;
  const mem = {};
  const ls = (() => { try { localStorage.setItem("__t","1"); localStorage.removeItem("__t"); return localStorage; } catch(e){ return null; } })();
  const get = k => ls ? ls.getItem(k) : (k in mem ? mem[k] : null);
  const put = (k,v) => { ls ? ls.setItem(k,v) : (mem[k]=v); };
  const rm  = k => { ls ? ls.removeItem(k) : delete mem[k]; };
  return {
    async get(k){ const v = get(k); if(v===null || v===undefined) throw new Error("not found: "+k); return {key:k, value:v}; },
    async set(k,v){ put(k,v); return {key:k, value:v}; },
    async delete(k){ rm(k); return {key:k, deleted:true}; },
    async list(){ return {keys:[]}; }
  };
})();

/* ============ Тогтмолууд ============ */
const KEY   = "khanuul_registry_v2";
const ADMIN = { user:"admin", pw:"khanuul2026" };

const CATS = [
  "Эмийн сан",
  "Баар / паб",
  "Караоке",
  "Ресторан, зоогийн газар",
  "Хүнсний дэлгүүр (8 нэрийн)",
  "Хүнсний дэлгүүр (6 нэрийн)",
  "Хүнсний дэлгүүр (архигүй)",
  "Худалдааны төв",
  "Зочид буудал",
  "Гоо сайхны салон",
  "Бариа засал",
  "Саун, массаж",
  "Авто засвар, угаалга",
  "Авто худалдаа",
  "Банк, санхүүгийн байгууллага",
  "Банк бус санхүүгийн байгууллага, ломбард",
  "Биллиард, тоглоомын газар",
  "Фитнес, спорт",
  "Боловсролын байгууллага",
  "Эрүүл мэндийн байгууллага",
  "Үйлдвэр",
  "Барилга угсралт",
  "Бусад үйлчилгээ"
];
const OWNERS   = ["Хувийн", "Төрийн өмчит", "Орон нутгийн өмчит", "Холимог өмчит", "Гадаадын хөрөнгө оруулалттай"];
const STATUSES = ["Идэвхтэй", "Түр зогссон", "Хаагдсан"];
const APPR     = { ok:"Зөвшөөрөгдсөн", pending:"Хүлээгдэж буй", rejected:"Татгалзсан" };
const KHOROOS  = Array.from({length:25}, (_,i)=>i+1);

/* ============ Туслах ============ */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hash = s => { let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return h.toString(36); };
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today = () => new Date().toISOString().slice(0,10);
function daysLeft(d){ if(!d) return null; const t=new Date(d); if(isNaN(t)) return null; return Math.round((t-new Date(today()))/86400000); }
function toast(t){ const el=document.createElement("div"); el.className="toast"; el.textContent=t; $("#toastHost").appendChild(el); setTimeout(()=>el.remove(), 2600); }
function fillSelect(sel, arr, val){ if(!sel) return; sel.innerHTML = arr.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(""); if(val!==undefined && val!==null) sel.value = val; }
const okOrgs   = () => DB.orgs.filter(o=>o.appr==="ok");
const pendings = () => DB.orgs.filter(o=>o.appr==="pending");

/* ============ Өгөгдөл ============ */
let DB = { orgs: [] };
let ME = null;   // {role:'admin'} эсвэл {role:'org', id}

function seed(){
  const mk = (name,reg,cat,own,kh,addr,area,staff,hours,lic,licEnd,dir,phone,mail,since,status,appr)=>({
    id:uid(), name, reg, cat, own, district:"Хан-Уул", khoroo:kh, addr, area, staff, hours,
    lic, licEnd, dir, phone, mail, since, status, note:"",
    appr, apprAt: appr==="ok" ? today() : "", apprNote:"",
    pw:hash("1234"), created:today(), notices:[]
  });
  return [
    mk("Ай Эм Си Фарм ХХК","6123456","Эмийн сан","Хувийн",3,"Чингисийн өргөн чөлөө 15, Наран төв 1 давхар",48,6,"09:00–21:00","ЭМ-2024/1187","2027-03-01","Б.Оюунчимэг","99112233","imcpharm@mail.mn","2019-05-14","Идэвхтэй","ok"),
    mk("Найт Стар Энтертайнмент ХХК","6234117","Караоке","Хувийн",11,"120 мянгат, Сүлд төвийн 2 давхар",210,14,"18:00–02:00","ХУД-2025/0442","2026-09-01","Д.Ганзориг","88445566","nightstar@mail.mn","2021-09-02","Идэвхтэй","ok"),
    mk("Зайсан Паб ХХК","6091834","Баар / паб","Хувийн",15,"Зайсангийн гудамж 4, 1-р байр",95,9,"12:00–00:00","ХУД-2024/0311","2026-10-05","Ч.Тэмүүлэн","94002211","zaisanpub@mail.mn","2018-06-11","Идэвхтэй","ok"),
    mk("Оргил Март ХХК","6455012","Хүнсний дэлгүүр (8 нэрийн)","Хувийн",4,"Яармагийн 2-р гудамж 21",130,11,"08:00–23:00","ХУД-2025/0908","2027-01-15","Н.Алтанцэцэг","95778899","orgilmart@mail.mn","2020-02-20","Идэвхтэй","ok"),
    mk("Толгойт Авто Худалдаа ХХК","6300945","Авто худалдаа","Хувийн",8,"Үйлдвэрийн бүс, 7-р гудамж 12",1450,17,"09:00–19:00","","","Ж.Батсайхан","99887744","autotrade@mail.mn","2017-11-30","Идэвхтэй","ok"),
    mk("Хан-Уул дүүргийн 63-р сургууль","9010063","Боловсролын байгууллага","Төрийн өмчит",20,"Их наяд, 63-р сургуулийн байр",6200,112,"07:30–19:00","","","С.Мөнхзул","80223344","school63@edu.mn","1998-09-01","Идэвхтэй","ok"),
    mk("Оргилуун Ундрага ББСБ ХХК","6688120","Банк бус санхүүгийн байгууллага, ломбард","Хувийн",3,"Чингисийн өргөн чөлөө 9, Сансар төв",75,8,"09:00–18:00","СЗХ-2025/0117","2028-02-01","Г.Энхжаргал","94551122","undraga@mail.mn","2023-03-15","Идэвхтэй","ok"),
    mk("Жаргалант Саун ХХК","6777301","Саун, массаж","Хувийн",11,"11-р хороо, 3-р хэсэг, 14-р байр",180,7,"10:00–23:00","","","Л.Отгонбаяр","99445511","jargalantsaun@mail.mn","2024-07-01","Идэвхтэй","pending")
  ];
}

async function seedStaff(){
  const demo = [
    ["6123456", [
      ["Б.Оюунчимэг","Захирал","99112233","2019-05-14","2027-02-10"],
      ["Э.Сарантуяа","Эм зүйч","99445566","2021-03-01","2026-11-05"],
      ["Т.Ганцэцэг","Худалдагч","88112244","2024-01-15","2026-08-20"]
    ]],
    ["6455012", [
      ["Н.Алтанцэцэг","Захирал","95778899","2020-02-20","2027-04-01"],
      ["Д.Батзориг","Кассчин","94223311","2023-06-10","2026-12-15"]
    ]]
  ];
  for(const [reg, people] of demo){
    const o = DB.orgs.find(x=>x.reg===reg); if(!o) continue;
    const list = people.map(([name,pos,phone,since,healthEnd])=>({
      id:uid(), name, pos, reg:"", phone, since, health:"ЭМД-"+Math.floor(Math.random()*90000+10000),
      healthEnd, status:"Ажиллаж байгаа", note:"", created:today()
    }));
    try{ await saveStaff(o.id, list, o); }catch(e){}
  }
}

async function loadDB(){
  try{
    const r = await DBX.get(KEY, true);
    DB = JSON.parse(r.value);
    if(!Array.isArray(DB.orgs)) DB.orgs = [];
    DB.orgs.forEach(o=>{ o.notices = o.notices||[]; o.appr = o.appr||"ok"; o.own = o.own||"Хувийн"; o.staffN = o.staffN||0; });
  }catch(e){
    DB = { orgs: seed() };
    try{ await saveDB(); await seedStaff(); }catch(_){}
  }
}
async function saveDB(){
  try{ await DBX.set(KEY, JSON.stringify(DB), true); }
  catch(e){ toast("Хадгалахад алдаа гарлаа. Дахин оролдоно уу."); throw e; }
}

/* ============ Зураг, бичиг баримт ============ */
const MKEY = id => "khanuul_media_" + id;
const mediaCache = {};
async function loadMedia(id){
  if(mediaCache[id]) return mediaCache[id];
  try{ const r = await DBX.get(MKEY(id), true); mediaCache[id] = JSON.parse(r.value); }
  catch(e){ mediaCache[id] = { photos:[], lic:null }; }
  if(!Array.isArray(mediaCache[id].photos)) mediaCache[id].photos = [];
  return mediaCache[id];
}
async function saveMedia(id, m){
  mediaCache[id] = m;
  try{ await DBX.set(MKEY(id), JSON.stringify(m), true); }
  catch(e){ toast("Файл хадгалахад алдаа гарлаа. Хэмжээг багасгаад дахин оролдоно уу."); throw e; }
}
function shrinkImage(file, max=1100, q=.72){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max/Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width*s); c.height = Math.round(img.height*s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", q));
      };
      img.onerror = rej; img.src = fr.result;
    };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
function cropPhoto34(file, w=300, h=400, q=.74){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0,0,w,h);
        const s = Math.max(w/img.width, h/img.height);      // дүүргэж тайрна
        const dw = img.width*s, dh = img.height*s;
        ctx.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);      // голлуулна
        res(c.toDataURL("image/jpeg", q));
      };
      img.onerror = rej; img.src = fr.result;
    };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}
function readAsData(file){
  return new Promise((res, rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); });
}
function downloadBlob(content, type, name){
  const url = URL.createObjectURL(new Blob([content], {type}));
  const a = document.createElement("a"); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}
function openData(dataUrl, name){
  const bin = atob(dataUrl.split(",")[1]);
  const type = dataUrl.slice(5, dataUrl.indexOf(";"));
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  downloadBlob(arr, type, name || "file");
}

/* ============ Ажилчдын бүртгэл ============ */
const SKEY = id => "khanuul_staff_" + id;
const staffCache = {};
const POSITIONS = ["Захирал","Менежер","Нягтлан бодогч","Худалдагч","Кассчин","Тогооч","Үйлчлэгч","Эмч","Эм зүйч","Бариа заслын мэргэжилтэн","Массажист","Гоо сайханч","Багш","Харуул, жижүүр","Инженер, техникч","Жолооч","Бусад"];
const STAFF_STATUS = ["Ажиллаж байгаа","Чөлөөлөгдсөн"];

async function loadStaff(id){
  if(staffCache[id]) return staffCache[id];
  try{ const r = await DBX.get(SKEY(id), true); const v = JSON.parse(r.value); staffCache[id] = Array.isArray(v) ? v : []; }
  catch(e){ staffCache[id] = []; }
  return staffCache[id];
}
async function saveStaff(id, list, org){
  staffCache[id] = list;
  try{ await DBX.set(SKEY(id), JSON.stringify(list), true); }
  catch(e){ toast("Ажилтны бүртгэл хадгалахад алдаа гарлаа."); throw e; }
  if(org){ org.staffN = list.filter(s=>s.status!=="Чөлөөлөгдсөн").length; await saveDB(); }
}
function healthPill(s){
  if(!s.healthEnd) return `<span class="pill neutral">Бүртгээгүй</span>`;
  const d = daysLeft(s.healthEnd);
  if(d===null) return `<span class="pill neutral">—</span>`;
  if(d<0) return `<span class="pill bad">Хугацаа дууссан</span>`;
  if(d<=30) return `<span class="pill warn">${d} хоног үлдсэн</span>`;
  return `<span class="pill ok">Хүчинтэй</span>`;
}

/* ============ Мэдэгдэл ============ */
function pushNotice(o, key, kind, text){
  o.notices = o.notices || [];
  if(o.notices.some(n=>n.key===key)) return false;
  o.notices.unshift({ id:uid(), key, kind, text, date:today(), read:false });
  return true;
}
async function ensureNotices(){
  let changed = false;
  DB.orgs.forEach(o=>{
    if(o.appr!=="ok") return;
    const d = daysLeft(o.licEnd);
    if(d===null) return;
    if(d<0)
      changed = pushNotice(o, "exp:"+o.licEnd, "bad",
        `Тусгай зөвшөөрлийн хугацаа ${o.licEnd}-нд дууссан. Үйл ажиллагаагаа үргэлжлүүлэхийн тулд зөвшөөрлөө сунгуулж, шинэ бичиг баримтаа энэ хуудсанд байршуулна уу.`) || changed;
    else if(d<=30)
      changed = pushNotice(o, "w30:"+o.licEnd, "warn",
        `Тусгай зөвшөөрлийн хугацаа дуусахад ${d} хоног үлдлээ (${o.licEnd}). Сунгуулах хүсэлтээ дүүргийн бүртгэлийн албанд хүргүүлнэ үү.`) || changed;
    else if(d<=60)
      changed = pushNotice(o, "w60:"+o.licEnd, "warn",
        `Тусгай зөвшөөрлийн хугацаа дуусахад ${d} хоног үлдлээ (${o.licEnd}).`) || changed;
  });
  if(changed){ try{ await saveDB(); }catch(e){} }
}
const unread = o => (o.notices||[]).filter(n=>!n.read).length;

/* ============ Нэвтрэх дэлгэц ============ */
function renderAuthStats(){
  const list = okOrgs();
  const rows = [
    ["Бүртгэлтэй нэгж", list.length],
    ["Идэвхтэй үйл ажиллагаатай", list.filter(o=>o.status==="Идэвхтэй").length],
    ["Хамрагдсан хороо", new Set(list.map(o=>o.khoroo)).size],
    ["Үйл ажиллагааны чиглэл", new Set(list.map(o=>o.cat)).size]
  ];
  $("#authStats").innerHTML = rows.map(([a,b])=>`<div class="stat-row"><b class="num">${b}</b><span>${a}</span></div>`).join("");
}
function authMsg(text, kind="err"){ $("#authMsg").innerHTML = text ? `<div class="msg ${kind}">${esc(text)}</div>` : ""; }

document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("on", x===t));
  const map = { login:"#fLogin", reg:"#fReg", admin:"#fAdmin" };
  document.querySelectorAll(".pane").forEach(p=>p.classList.add("hidden"));
  $(map[t.dataset.tab]).classList.remove("hidden");
  authMsg("");
});

$("#fLogin").onsubmit = e => {
  e.preventDefault();
  const reg = $("#li_reg").value.trim(), pw = $("#li_pw").value;
  const o = DB.orgs.find(x=>x.reg===reg);
  if(!o || o.pw!==hash(pw)) return authMsg("Бүртгэлийн дугаар эсвэл нууц үг буруу байна.");
  ME = { role:"org", id:o.id }; enterApp();
};

$("#fReg").onsubmit = async e => {
  e.preventDefault();
  const reg = $("#rg_reg").value.trim();
  if(!/^\d{6,8}$/.test(reg)) return authMsg("Улсын бүртгэлийн дугаар 6–8 оронтой тоо байна.");
  if(DB.orgs.some(x=>x.reg===reg)) return authMsg("Энэ бүртгэлийн дугаар аль хэдийн бүртгэгдсэн байна.");
  if($("#rg_pw").value.length<4) return authMsg("Нууц үг дор хаяж 4 тэмдэгт байна.");
  if($("#rg_pw").value !== $("#rg_pw2").value) return authMsg("Нууц үг таарахгүй байна.");
  const o = {
    id:uid(), name:$("#rg_name").value.trim(), reg,
    cat:$("#rg_cat").value, own:$("#rg_own").value,
    district:"Хан-Уул", khoroo:Number($("#rg_khoroo").value), addr:$("#rg_addr").value.trim(),
    area:"", staff:"", hours:"", lic:"", licEnd:"", dir:$("#rg_dir").value.trim(),
    phone:$("#rg_phone").value.trim(), mail:"", since:"", status:"Идэвхтэй", note:"",
    appr:"pending", apprAt:"", apprNote:"",
    pw:hash($("#rg_pw").value), created:today(), notices:[]
  };
  pushNotice(o, "req:"+o.id, "info",
    "Бүртгүүлэх хүсэлт хүлээн авлаа. Дүүргийн бүртгэлийн алба хянаж, зөвшөөрөл олгосны дараа таны бүртгэл системд бүрэн идэвхжинэ. Хүлээгдэж байх хугацаанд мэдээлэл, зураг, зөвшөөрлийн баримтаа оруулж болно.");
  DB.orgs.push(o); await saveDB();
  ME = { role:"org", id:o.id }; enterApp();
  toast("Хүсэлт илгээгдлээ. Админы зөвшөөрлийг хүлээнэ үү.");
};

$("#fAdmin").onsubmit = e => {
  e.preventDefault();
  if($("#ad_user").value.trim()!==ADMIN.user || $("#ad_pw").value!==ADMIN.pw) return authMsg("Админ код эсвэл нууц үг буруу байна.");
  ME = { role:"admin" }; enterApp();
};

$("#btnOut").onclick = () => {
  ME = null; $("#app").classList.add("hidden"); $("#auth").classList.remove("hidden");
  $("#li_pw").value=""; $("#ad_pw").value=""; renderAuthStats(); authMsg("");
};

function enterApp(){
  $("#auth").classList.add("hidden"); $("#app").classList.remove("hidden");
  render();
}

/* ============ Дүрслэл ============ */
function render(){
  if(!ME) return;
  if(ME.role==="admin"){
    const p = pendings().length;
    $("#roleLine").textContent = "Дүүргийн нэгдсэн мэдээллийн сан — бүх байгууллагын мэдээлэл";
    $("#whoBox").innerHTML = `<b>Админ${p?`<span class="badge">${p} хүсэлт</span>`:""}</b>Дүүргийн бүртгэлийн алба`;
    renderAdmin();
  }else{
    const o = DB.orgs.find(x=>x.id===ME.id);
    if(!o){ $("#btnOut").click(); return; }
    const un = unread(o);
    $("#roleLine").textContent = "Байгууллагын хуудас — зөвхөн өөрийн мэдээлэл";
    $("#whoBox").innerHTML = `<b>${esc(o.name)}${un?`<span class="badge">${un} мэдэгдэл</span>`:""}</b>Бүртгэл №${esc(o.reg)}`;
    renderOrg(o);
  }
}

/* ---------- Шошго ---------- */
function statusPill(s){
  const k = s==="Идэвхтэй" ? "ok" : s==="Түр зогссон" ? "warn" : "bad";
  return `<span class="pill ${k}">${esc(s)}</span>`;
}
function apprPill(o){
  const k = o.appr==="ok" ? "ok" : o.appr==="pending" ? "warn" : "bad";
  return `<span class="pill ${k}">${esc(APPR[o.appr]||o.appr)}</span>`;
}
function licPill(o){
  if(!o.lic && !o.licEnd) return `<span class="pill neutral">Бүртгээгүй</span>`;
  const d = daysLeft(o.licEnd);
  if(d===null) return `<span class="pill neutral">${esc(o.lic)}</span>`;
  if(d<0) return `<span class="pill bad">Хугацаа дууссан</span>`;
  if(d<=60) return `<span class="pill warn">${d} хоног үлдсэн</span>`;
  return `<span class="pill ok">Хүчинтэй</span>`;
}
function kvTable(o){
  const rows = [
    ["Байгууллагын нэр", o.name],
    ["Улсын бүртгэлийн дугаар", o.reg],
    ["Үйл ажиллагааны чиглэл", o.cat],
    ["Өмчийн хэлбэр", o.own],
    ["Байршил", `${o.district} дүүрэг, ${o.khoroo}-р хороо`],
    ["Дэлгэрэнгүй хаяг", o.addr],
    ["Үйл ажиллагааны талбай", o.area ? o.area+" м²" : ""],
    ["Ажиллагсдын тоо", o.staff],
    ["Ажиллах цагийн хуваарь", o.hours],
    ["Тусгай зөвшөөрлийн дугаар", o.lic],
    ["Зөвшөөрөл дуусах огноо", o.licEnd ? `${esc(o.licEnd)} &nbsp; ${licPill(o)}` : ""],
    ["Захирал / эзэмшигч", o.dir],
    ["Утас", o.phone],
    ["И-мэйл", o.mail],
    ["Үйл ажиллагаа эхэлсэн", o.since],
    ["Төлөв", statusPill(o.status)],
    ["Бүртгэлийн төлөв", apprPill(o)],
    ["Тэмдэглэл", o.note],
    ["Бүртгүүлсэн огноо", o.created]
  ];
  return `<dl class="kv">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${v ? (String(v).includes("<") ? v : esc(v)) : '<span class="note">—</span>'}</dd>`).join("")}</dl>`;
}

/* ---------- Байгууллагын хуудас ---------- */
function mediaPanels(){
  return `
    <div class="panel">
      <h3>Тусгай зөвшөөрлийн баримт</h3>
      <div class="body">
        <div class="filebox" id="licBox"><span class="note">Ачаалж байна…</span></div>
        <p class="note" style="margin-top:10px">Гэрчилгээний зураг эсвэл PDF. Дугаар, дуусах огноог “Мэдээлэл засах” хэсгээс оруулна.</p>
      </div>
    </div>
    <div class="panel">
      <h3>Байгууллагын зураг</h3>
      <div class="body">
        <div class="gallery" id="gal"><span class="note">Ачаалж байна…</span></div>
        <div style="margin-top:12px"><label class="upl">Зураг нэмэх<input type="file" accept="image/*" multiple id="upPhoto"></label></div>
        <p class="note" style="margin-top:8px">Хамгийн ихдээ 6 зураг. Зургийг автоматаар шахаж хадгална.</p>
      </div>
    </div>`;
}

function renderOrg(o){
  if(o.appr!=="ok") return renderOrgPending(o);
  const notices = (o.notices||[]).slice(0,12);
  const un = unread(o);
  const d = daysLeft(o.licEnd);
  const licCell = d===null
    ? `<b style="font-size:19px;padding-top:6px"><span class="pill neutral">Огноо оруулаагүй</span></b><span>Тусгай зөвшөөрөл</span>`
    : d<0
      ? `<b class="num" style="color:var(--bad)">${-d}</b><span>Зөвшөөрөл дууссанаас хойш, хоног</span>`
      : `<b class="num" style="color:${d<=60?"var(--warn)":"inherit"}">${d}</b><span>Зөвшөөрөл дуусахад үлдсэн хоног</span>`;

  $("#view").innerHTML = `
    <div class="panel">
      <h3>Мэдэгдэл ${un?`<span class="badge">${un} шинэ</span>`:""}</h3>
      <div class="body">
        ${notices.length ? notices.map(n=>`
          <div class="notice ${esc(n.kind)}">
            ${n.read?"":'<span class="dot"></span>'}
            <div><div>${esc(n.text)}</div><div class="when">${esc(n.date)}${n.read?"":" · шинэ"}</div></div>
          </div>`).join("") : `<p class="note">Одоогоор мэдэгдэл алга.</p>`}
        ${un ? `<button class="btn ghost sm" id="oRead" style="margin-top:8px">Бүгдийг уншсан болгох</button>` : ""}
      </div>
    </div>

    <div class="strip">
      <div><b>${esc(o.khoroo)}</b><span>${esc(o.district)} дүүрэг, дугаар хороо</span></div>
      <div><b class="num">${esc(o.staff||"—")}</b><span>Ажиллагсдын тоо</span></div>
      <div><b class="num">${esc(o.area||"—")}</b><span>Талбай, м²</span></div>
      <div>${licCell}</div>
    </div>

    <div class="panel">
      <h3>Ажилчдын бүртгэл</h3>
      <div class="body">
        <div class="khoroo-pick" style="justify-content:space-between">
          <div class="count-tag" id="staffMeta">Ачаалж байна…</div>
          <div class="acts" style="display:flex;gap:9px;flex-wrap:wrap">
            <button class="btn ghost sm" id="staffCsv">Ажилчдын CSV</button>
            <button class="btn sm" id="staffAdd">Ажилтан нэмэх</button>
          </div>
        </div>
        <div class="tblwrap" id="staffBox"></div>
      </div>
    </div>

    ${mediaPanels()}

    <div class="panel">
      <h3>Бүртгэлийн мэдээлэл</h3>
      <div class="body">${kvTable(o)}</div>
      <div style="padding:14px 18px;border-top:1px solid var(--line-soft);display:flex;gap:9px;flex-wrap:wrap">
        <button class="btn" id="oEdit">Мэдээлэл засах</button>
        <button class="btn ghost" id="oAnket">Анкет татах</button>
        <button class="btn ghost" id="oCsv">Excel (CSV) татах</button>
        <button class="btn ghost" id="oPw">Нууц үг солих</button>
      </div>
    </div>
    <p class="note">Таны оруулсан мэдээлэл, зураг дүүргийн бүртгэлийн албанд харагдана. Бусад байгууллага таны мэдээллийг харах боломжгүй.</p>
  `;
  $("#oEdit").onclick  = () => orgForm(o);
  $("#oPw").onclick    = () => pwForm(o);
  $("#oCsv").onclick   = () => exportCSV([o], `burtgel_${o.reg}.csv`);
  $("#oAnket").onclick = () => downloadAnket(o);
  if($("#oRead")) $("#oRead").onclick = async () => { (o.notices||[]).forEach(n=>n.read=true); await saveDB(); render(); };
  $("#staffAdd").onclick = () => staffForm(o, null);
  $("#staffCsv").onclick = async () => exportStaffCSV(o, await loadStaff(o.id));
  paintOrgMedia(o);
  paintStaff(o, true);
}

function renderOrgPending(o){
  const pending = o.appr==="pending";
  $("#view").innerHTML = `
    <div class="msg ${pending?"":"err"}" style="${pending?"background:var(--gold-soft);color:var(--warn);border-left-color:var(--gold)":""}">
      ${pending
        ? "Таны бүртгүүлэх хүсэлт админы хяналтад байна. Зөвшөөрөл олгогдтол таны бүртгэл нийтийн санд харагдахгүй. Хүлээх хугацаандаа мэдээлэл, зураг, зөвшөөрлийн баримтаа бүрэн оруулбал хянах ажил хурдан явагдана."
        : "Таны хүсэлтийг админ татгалзсан байна. Шалтгаан: " + (o.apprNote || "тодорхойлоогүй") + ". Мэдээллээ засаад дахин хүсэлт илгээх боломжтой."}
    </div>

    <div class="strip">
      <div><b style="font-size:19px;padding-top:6px">${apprPill(o)}</b><span>Бүртгэлийн төлөв</span></div>
      <div><b>${esc(o.khoroo)}</b><span>${esc(o.district)} дүүрэг, дугаар хороо</span></div>
      <div><b style="font-size:16px;padding-top:9px">${esc(o.cat)}</b><span>Үйл ажиллагааны чиглэл</span></div>
      <div><b style="font-size:16px;padding-top:9px">${esc(o.own)}</b><span>Өмчийн хэлбэр</span></div>
    </div>

    ${mediaPanels()}

    <div class="panel">
      <h3>Хүсэлтэд оруулсан мэдээлэл</h3>
      <div class="body">${kvTable(o)}</div>
      <div style="padding:14px 18px;border-top:1px solid var(--line-soft);display:flex;gap:9px;flex-wrap:wrap">
        <button class="btn" id="oEdit">Мэдээлэл засах</button>
        ${o.appr==="rejected" ? `<button class="btn" id="oAgain">Дахин хүсэлт илгээх</button>` : ""}
        <button class="btn ghost" id="oPw">Нууц үг солих</button>
      </div>
    </div>`;
  $("#oEdit").onclick = () => orgForm(o);
  $("#oPw").onclick = () => pwForm(o);
  if($("#oAgain")) $("#oAgain").onclick = async () => {
    o.appr = "pending"; o.apprNote = "";
    pushNotice(o, "req:"+uid(), "info", "Бүртгэлийн хүсэлтээ дахин илгээлээ. Админы хариуг хүлээнэ үү.");
    await saveDB(); render(); toast("Хүсэлтийг дахин илгээлээ.");
  };
  paintOrgMedia(o);
}

async function paintOrgMedia(o){
  const m = await loadMedia(o.id);

  const box = $("#licBox"); if(!box) return;
  box.innerHTML = m.lic
    ? `${m.lic.data.startsWith("data:image") ? `<img src="${m.lic.data}" alt="Тусгай зөвшөөрөл">` : `<span>📄 ${esc(m.lic.name)}</span>`}
       <div style="display:flex;gap:9px;flex-wrap:wrap">
         <button class="btn ghost sm" id="licGet">Татаж авах</button>
         <button class="btn ghost sm" id="licDel">Устгах</button>
         <label class="upl" style="padding:6px 11px;font-size:12.5px">Солих<input type="file" accept="image/*,application/pdf" id="licUp"></label>
       </div>`
    : `<span class="note">Зөвшөөрлийн баримт байршуулаагүй байна.</span>
       <label class="upl">Баримт байршуулах<input type="file" accept="image/*,application/pdf" id="licUp"></label>`;

  const licUpload = async e => {
    const f = e.target.files[0]; if(!f) return;
    if(f.size > 4*1024*1024) return toast("Файл 4 МБ-аас бага байх ёстой.");
    const data = f.type.startsWith("image/") ? await shrinkImage(f, 1400, .78) : await readAsData(f);
    m.lic = { name:f.name, data, at:today() };
    await saveMedia(o.id, m); toast("Зөвшөөрлийн баримт хадгалагдлаа."); paintOrgMedia(o);
  };
  if($("#licUp"))  $("#licUp").onchange = licUpload;
  if($("#licGet")) $("#licGet").onclick = () => openData(m.lic.data, m.lic.name);
  if($("#licDel")) $("#licDel").onclick = async () => { m.lic=null; await saveMedia(o.id,m); paintOrgMedia(o); toast("Баримтыг устгалаа."); };

  const gal = $("#gal"); if(!gal) return;
  gal.innerHTML = m.photos.length
    ? m.photos.map((p,i)=>`<div class="shot"><img src="${p}" alt="Байгууллагын зураг ${i+1}"><button data-i="${i}">Устгах</button></div>`).join("")
    : `<p class="note">Зураг оруулаагүй байна.</p>`;
  gal.querySelectorAll("[data-i]").forEach(b=>b.onclick = async () => {
    m.photos.splice(+b.dataset.i,1); await saveMedia(o.id,m); paintOrgMedia(o); toast("Зургийг устгалаа.");
  });
  $("#upPhoto").onchange = async e => {
    const files = [...e.target.files];
    if(!files.length) return;
    if(m.photos.length + files.length > 6) return toast("Хамгийн ихдээ 6 зураг байршуулна.");
    for(const f of files){ if(f.type.startsWith("image/")) m.photos.push(await shrinkImage(f)); }
    await saveMedia(o.id, m); paintOrgMedia(o); toast("Зураг хадгалагдлаа.");
  };
}

/* ---------- Админ хуудас ---------- */
let F = { q:"", cat:"", own:"", khoroo:"", status:"", appr:"", sort:"name", dir:1 };
let KH = "";  // хороогоор харах хэсгийн сонголт

function renderAdmin(){
  const list = okOrgs();
  const expiring = list.filter(o=>{ const d=daysLeft(o.licEnd); return d!==null && d<=60; }).length;
  const reqs = pendings();

  $("#view").innerHTML = `
    ${reqs.length ? `
    <div class="panel">
      <h3>Бүртгүүлэх хүсэлт <span class="badge">${reqs.length}</span></h3>
      <div class="body">
        ${reqs.map(o=>`
          <div class="req">
            <div>
              <div class="name">${esc(o.name)}</div>
              <div class="meta">№${esc(o.reg)} · ${esc(o.cat)} · ${esc(o.own)} · ${esc(o.khoroo)}-р хороо · ${esc(o.phone)||"утас оруулаагүй"} · ${esc(o.created)}</div>
            </div>
            <div class="acts">
              <button class="btn ghost sm" data-see="${o.id}">Дэлгэрэнгүй</button>
              <button class="btn ghost sm" data-no="${o.id}">Татгалзах</button>
              <button class="btn sm" data-yes="${o.id}">Зөвшөөрөх</button>
            </div>
          </div>`).join("")}
      </div>
    </div>` : ""}

    <div class="strip">
      <div><b class="num">${list.length}</b><span>Зөвшөөрөгдсөн нэгж</span></div>
      <div><b class="num">${list.filter(o=>o.status==="Идэвхтэй").length}</b><span>Идэвхтэй үйл ажиллагаатай</span></div>
      <div><b class="num">${expiring}</b><span>Зөвшөөрөл дуусах / дууссан</span></div>
      <div><b class="num">${reqs.length}</b><span>Хүлээгдэж буй хүсэлт</span></div>
    </div>

    <div class="toolbar">
      <div class="field" style="flex:2"><label>Хайх</label><input id="fq" placeholder="нэр, бүртгэлийн дугаар, хаяг, захирал" value="${esc(F.q)}"></div>
      <div class="field"><label>Чиглэл</label><select id="fcat"></select></div>
      <div class="field"><label>Өмчийн хэлбэр</label><select id="fown"></select></div>
      <div class="field"><label>Хороо</label><select id="fkh"></select></div>
      <div class="field"><label>Төлөв</label><select id="fst"></select></div>
      <div class="field"><label>Бүртгэл</label><select id="fap"></select></div>
      <button class="btn ghost" id="fclear">Шүүлт цэвэрлэх</button>
      <button class="btn ghost" id="bcsv">CSV татах</button>
      <button class="btn" id="badd">Байгууллага нэмэх</button>
    </div>

    <div class="panel">
      <h3 id="listTitle"></h3>
      <div class="tblwrap" id="tbl"></div>
    </div>

    <div class="panel">
      <h3>Хороогоор харах</h3>
      <div class="body">
        <div class="khoroo-pick">
          <div class="field"><label>Хороо сонгох</label><select id="khSel"></select></div>
          <div class="count-tag" id="khCount"></div>
        </div>
        <div class="tblwrap" id="khList"></div>
      </div>
    </div>

    <div class="panel">
      <h3>Үйл ажиллагааны чиглэлээр</h3>
      <div class="body"><div class="bars" id="byCat"></div></div>
    </div>
    <div class="panel">
      <h3>Өмчийн хэлбэрээр</h3>
      <div class="body"><div class="bars" id="byOwn"></div></div>
    </div>
    <div class="panel">
      <h3>Хороогоор</h3>
      <div class="body"><div class="bars" id="byKh"></div></div>
    </div>
  `;

  // хүсэлтийн товчнууд
  $("#view").querySelectorAll("[data-yes]").forEach(b=>b.onclick=()=>approveOrg(b.dataset.yes));
  $("#view").querySelectorAll("[data-no]").forEach(b=>b.onclick=()=>rejectForm(b.dataset.no));
  $("#view").querySelectorAll("[data-see]").forEach(b=>b.onclick=()=>detail(b.dataset.see));

  fillSelect($("#fcat"), ["Бүгд", ...CATS], F.cat||"Бүгд");
  fillSelect($("#fown"), ["Бүгд", ...OWNERS], F.own||"Бүгд");
  fillSelect($("#fkh"),  ["Бүгд", ...KHOROOS.map(k=>k+"-р хороо")], F.khoroo ? F.khoroo+"-р хороо" : "Бүгд");
  fillSelect($("#fst"),  ["Бүгд", ...STATUSES], F.status||"Бүгд");
  fillSelect($("#fap"),  ["Бүгд", ...Object.values(APPR)], F.appr ? APPR[F.appr] : "Бүгд");

  $("#fq").oninput    = e => { F.q = e.target.value; paintTable(); };
  $("#fcat").onchange = e => { F.cat = e.target.value==="Бүгд"?"":e.target.value; paintTable(); };
  $("#fown").onchange = e => { F.own = e.target.value==="Бүгд"?"":e.target.value; paintTable(); };
  $("#fkh").onchange  = e => { F.khoroo = e.target.value==="Бүгд"?"":parseInt(e.target.value); paintTable(); };
  $("#fst").onchange  = e => { F.status = e.target.value==="Бүгд"?"":e.target.value; paintTable(); };
  $("#fap").onchange  = e => {
    const v = e.target.value;
    F.appr = v==="Бүгд" ? "" : Object.keys(APPR).find(k=>APPR[k]===v) || "";
    paintTable();
  };
  $("#fclear").onclick = () => { F = {q:"",cat:"",own:"",khoroo:"",status:"",appr:"",sort:F.sort,dir:F.dir}; renderAdmin(); };
  $("#bcsv").onclick   = () => exportCSV(filtered(), "khan_uul_burtgel.csv");
  $("#badd").onclick   = () => orgForm(null);

  fillSelect($("#khSel"), ["— сонгох —", ...KHOROOS.map(k=>k+"-р хороо")], KH || "— сонгох —");
  $("#khSel").onchange = e => { KH = e.target.value==="— сонгох —" ? "" : e.target.value; paintKhoroo(); };

  paintTable(); paintKhoroo(); paintBars();
}

async function approveOrg(id){
  const o = DB.orgs.find(x=>x.id===id); if(!o) return;
  o.appr = "ok"; o.apprAt = today(); o.apprNote = "";
  pushNotice(o, "appr:"+today()+":"+o.id, "info",
    "Бүртгэлийн хүсэлт зөвшөөрөгдлөө. Таны байгууллага дүүргийн нэгдсэн бүртгэлд албан ёсоор бүртгэгдлээ. Мэдээллээ бүрэн гүйцэд байлгаж, зөвшөөрлийн хугацааг хянаж байхыг анхаарна уу.");
  await saveDB(); await ensureNotices(); render(); toast("Зөвшөөрөл олголоо.");
}

function rejectForm(id){
  const o = DB.orgs.find(x=>x.id===id); if(!o) return;
  openModal(`Хүсэлт татгалзах — ${o.name}`, `
    <div class="field"><label>Татгалзсан шалтгаан</label>
      <textarea id="rj_text" rows="3" placeholder="Жишээ: Улсын бүртгэлийн гэрчилгээний хуулбар дутуу байна."></textarea></div>
    <p class="note">Шалтгаан байгууллагад мэдэгдэл болж очих бөгөөд тэд мэдээллээ засаад дахин хүсэлт илгээх боломжтой.</p>`, [
    {label:"Болих", cls:"ghost", act:closeModal},
    {label:"Татгалзах", cls:"danger", act:async ()=>{
      const t = $("#rj_text").value.trim();
      if(!t) return toast("Шалтгаанаа бичнэ үү.");
      o.appr = "rejected"; o.apprNote = t;
      pushNotice(o, "rej:"+uid(), "bad", "Бүртгэлийн хүсэлтийг татгалзлаа. Шалтгаан: " + t);
      await saveDB(); closeModal(); render(); toast("Хүсэлтийг татгалзлаа.");
    }}
  ]);
}

function filtered(){
  const q = F.q.trim().toLowerCase();
  const list = DB.orgs.filter(o=>{
    if(F.cat && o.cat!==F.cat) return false;
    if(F.own && o.own!==F.own) return false;
    if(F.khoroo && Number(o.khoroo)!==F.khoroo) return false;
    if(F.status && o.status!==F.status) return false;
    if(F.appr && o.appr!==F.appr) return false;
    if(q){
      const hay = [o.name,o.reg,o.addr,o.dir,o.phone,o.cat,o.own,o.lic].join(" ").toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
  list.sort((a,b)=>{
    let x = a[F.sort] ?? "", y = b[F.sort] ?? "";
    if(F.sort==="khoroo" || F.sort==="staff" || F.sort==="staffN"){ return ((Number(x)||0) - (Number(y)||0)) * F.dir; }
    return String(x).localeCompare(String(y), "mn") * F.dir;
  });
  return list;
}

function paintTable(){
  const list = filtered();
  $("#listTitle").textContent = `Бүртгэлийн жагсаалт — ${list.length} нэгж`;
  if(!list.length){ $("#tbl").innerHTML = `<div class="empty">Шүүлтэд тохирох бүртгэл олдсонгүй. Шүүлтээ өөрчилж үзнэ үү.</div>`; return; }
  const th = (k,t)=>`<th class="sortable" data-k="${k}">${t}${F.sort===k?(F.dir>0?" ↑":" ↓"):""}</th>`;
  $("#tbl").innerHTML = `
    <table>
      <thead><tr>
        ${th("name","Байгууллага")}${th("cat","Чиглэл")}${th("own","Өмч")}${th("khoroo","Хороо")}
        <th>Хаяг</th>${th("staffN","Ажилтан")}<th>Зөвшөөрөл</th>${th("status","Төлөв")}<th>Бүртгэл</th><th>Холбоо барих</th><th></th>
      </tr></thead>
      <tbody>${list.map(o=>`
        <tr>
          <td><div class="name">${esc(o.name)}</div><div class="reg">№${esc(o.reg)}</div></td>
          <td>${esc(o.cat)}</td>
          <td>${esc(o.own)}</td>
          <td class="num">${esc(o.khoroo)}</td>
          <td>${esc(o.addr)||'<span class="note">—</span>'}</td>
          <td class="num">${o.staffN||0}<div class="reg">зарласан ${esc(o.staff)||"—"}</div></td>
          <td>${licPill(o)}</td>
          <td>${statusPill(o.status)}</td>
          <td>${apprPill(o)}</td>
          <td>${esc(o.dir)}<div class="reg">${esc(o.phone)}</div></td>
          <td><button class="btn ghost sm" data-open="${o.id}">Дэлгэрэнгүй</button></td>
        </tr>`).join("")}
      </tbody>
    </table>`;
  $("#tbl").querySelectorAll("th.sortable").forEach(h=>h.onclick=()=>{
    const k = h.dataset.k; F.dir = (F.sort===k) ? -F.dir : 1; F.sort = k; paintTable();
  });
  $("#tbl").querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>detail(b.dataset.open));
}

function paintKhoroo(){
  const host = $("#khList"), tag = $("#khCount"); if(!host) return;
  if(!KH){ tag.textContent = ""; host.innerHTML = `<p class="note">Хороо сонгоход тухайн хороонд бүртгэлтэй байгууллагууд энд жагсана.</p>`; return; }
  const n = parseInt(KH);
  const list = DB.orgs.filter(o=>Number(o.khoroo)===n).sort((a,b)=>String(a.name).localeCompare(String(b.name),"mn"));
  tag.textContent = `${n}-р хороо — нийт ${list.length} нэгж (зөвшөөрөгдсөн ${list.filter(o=>o.appr==="ok").length})`;
  host.innerHTML = list.length ? `
    <table>
      <thead><tr><th>Байгууллага</th><th>Чиглэл</th><th>Өмч</th><th>Хаяг</th><th>Зөвшөөрөл</th><th>Төлөв</th><th>Бүртгэл</th><th></th></tr></thead>
      <tbody>${list.map(o=>`
        <tr>
          <td><div class="name">${esc(o.name)}</div><div class="reg">№${esc(o.reg)}</div></td>
          <td>${esc(o.cat)}</td>
          <td>${esc(o.own)}</td>
          <td>${esc(o.addr)||'<span class="note">—</span>'}</td>
          <td>${licPill(o)}</td>
          <td>${statusPill(o.status)}</td>
          <td>${apprPill(o)}</td>
          <td><button class="btn ghost sm" data-open2="${o.id}">Дэлгэрэнгүй</button></td>
        </tr>`).join("")}</tbody>
    </table>` : `<div class="empty">${n}-р хороонд бүртгэлтэй нэгж алга байна.</div>`;
  host.querySelectorAll("[data-open2]").forEach(b=>b.onclick=()=>detail(b.dataset.open2));
}

function paintBars(){
  const draw = (host, pairs, onPick) => {
    if(!host) return;
    const max = Math.max(1, ...pairs.map(p=>p[1]));
    host.innerHTML = pairs.length ? pairs.map(([k,v])=>`
      <div class="barrow"><span class="${onPick?"clickable":""}" data-key="${esc(k)}">${esc(k)}</span>
        <span class="bartrack"><span class="barfill" style="width:${Math.round(v/max*100)}%"></span></span>
        <i class="num">${v}</i></div>`).join("") : `<p class="note">Мэдээлэл алга.</p>`;
    if(onPick) host.querySelectorAll("[data-key]").forEach(el=>el.onclick=()=>onPick(el.dataset.key));
  };
  const count = key => {
    const m = new Map();
    okOrgs().forEach(o=>m.set(o[key], (m.get(o[key])||0)+1));
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  };
  draw($("#byCat"), count("cat"), v => { F.cat = v; renderAdmin(); window.scrollTo({top:0,behavior:"smooth"}); });
  draw($("#byOwn"), count("own"), v => { F.own = v; renderAdmin(); window.scrollTo({top:0,behavior:"smooth"}); });
  draw($("#byKh"),  count("khoroo").map(([k,v])=>[k+"-р хороо", v]).sort((a,b)=>b[1]-a[1]),
       v => { KH = v; fillSelect($("#khSel"), ["— сонгох —", ...KHOROOS.map(k=>k+"-р хороо")], KH); paintKhoroo(); $("#khList").scrollIntoView({behavior:"smooth", block:"center"}); });
}

function detail(id){
  const o = DB.orgs.find(x=>x.id===id); if(!o) return;
  const nlist = (o.notices||[]).slice(0,6);
  const body = `
    <div id="admMedia"><p class="note">Зураг, баримт ачаалж байна…</p></div>
    ${kvTable(o)}
    <h3 style="font-size:14px;margin:18px 0 9px">Ажилчдын бүртгэл</h3>
    <div class="count-tag" id="staffMeta"></div>
    <div class="tblwrap" id="staffBox"><p class="note">Ачаалж байна…</p></div>
    ${o.appr==="rejected" && o.apprNote ? `<div class="msg err" style="margin-top:14px">Татгалзсан шалтгаан: ${esc(o.apprNote)}</div>` : ""}
    <h3 style="font-size:14px;margin:18px 0 9px">Илгээсэн мэдэгдэл</h3>
    ${nlist.length ? nlist.map(n=>`<div class="notice ${esc(n.kind)}"><div><div>${esc(n.text)}</div>
      <div class="when">${esc(n.date)} · ${n.read?"уншсан":"уншаагүй"}</div></div></div>`).join("")
      : `<p class="note">Мэдэгдэл илгээгээгүй байна.</p>`}
  `;
  const acts = [
    {label:"Хаах", cls:"ghost", act:closeModal},
    {label:"Устгах", cls:"danger", act:(btn)=>{
      if(btn.dataset.armed){
        DB.orgs = DB.orgs.filter(x=>x.id!==id);
        DBX.delete(MKEY(id), true).catch(()=>{});
        DBX.delete(SKEY(id), true).catch(()=>{});
        delete mediaCache[id]; delete staffCache[id];
        saveDB().then(()=>{ closeModal(); render(); toast("Бүртгэлийг устгалаа."); });
      } else { btn.dataset.armed="1"; btn.textContent="Устгахыг баталгаажуулах"; }
    }},
    {label:"Нууц үг сэргээх", cls:"ghost", act:async ()=>{
      o.pw = hash("1234");
      pushNotice(o, "pw:"+uid(), "info", "Админ таны нууц үгийг 1234 болгон сэргээлээ. Нэвтэрсний дараа шинэ нууц үг тохируулна уу.");
      await saveDB(); closeModal(); render(); toast("Нууц үгийг 1234 болголоо.");
    }},
    {label:"Анкет татах", cls:"ghost", act:()=>downloadAnket(o)},
    {label:"Мэдэгдэл илгээх", cls:"ghost", act:()=>{ closeModal(); noticeForm(o); }},
    {label:"Засах", cls:"", act:()=>{ closeModal(); orgForm(o); }}
  ];
  if(o.appr==="pending"){
    acts.splice(1, 0,
      {label:"Татгалзах", cls:"danger", act:()=>{ closeModal(); rejectForm(o.id); }},
      {label:"Зөвшөөрөх", cls:"", act:()=>{ closeModal(); approveOrg(o.id); }});
  }
  openModal(o.name, body, acts);
  paintAdminMedia(o);
  paintStaff(o, false);
}

async function paintAdminMedia(o){
  const m = await loadMedia(o.id);
  const host = $("#admMedia"); if(!host) return;
  host.innerHTML = `
    ${m.lic ? `<div class="filebox" style="margin-bottom:14px">
        ${m.lic.data.startsWith("data:image") ? `<img src="${m.lic.data}" alt="Тусгай зөвшөөрөл">` : `<span>📄 ${esc(m.lic.name)}</span>`}
        <div><div style="font-size:13px;font-weight:600">Тусгай зөвшөөрлийн баримт</div>
        <div class="note">Байршуулсан: ${esc(m.lic.at||"—")}</div>
        <button class="btn ghost sm" id="admLicGet" style="margin-top:7px">Татаж авах</button></div>
      </div>` : `<p class="note">Тусгай зөвшөөрлийн баримт байршуулаагүй.</p>`}
    ${m.photos.length ? `<div class="gallery" style="margin-bottom:14px">${m.photos.map((p,i)=>`<div class="shot"><img src="${p}" alt="Зураг ${i+1}"></div>`).join("")}</div>`
      : `<p class="note">Байгууллагын зураг оруулаагүй.</p>`}`;
  if($("#admLicGet")) $("#admLicGet").onclick = () => openData(m.lic.data, m.lic.name);
}

function noticeForm(o){
  openModal(`Мэдэгдэл илгээх — ${o.name}`, `
    <div class="field"><label>Төрөл</label><select id="n_kind">
      <option value="info">Мэдээлэл</option><option value="warn">Анхааруулга</option><option value="bad">Шаардлага</option>
    </select></div>
    <div class="field"><label>Мэдэгдлийн агуулга</label><textarea id="n_text" rows="4" placeholder="Жишээ: Тусгай зөвшөөрлийн хуулбарыг 10 хоногийн дотор системд байршуулна уу."></textarea></div>
    <p class="note">Мэдэгдэл тухайн байгууллагын хуудсанд шууд харагдана.</p>`, [
    {label:"Болих", cls:"ghost", act:closeModal},
    {label:"Илгээх", cls:"", act:async ()=>{
      const t = $("#n_text").value.trim();
      if(!t) return toast("Агуулгаа бичнэ үү.");
      pushNotice(o, "adm:"+uid(), $("#n_kind").value, t);
      await saveDB(); closeModal(); render(); toast("Мэдэгдлийг илгээлээ.");
    }}
  ]);
}

/* ---------- Ажилчид ---------- */
async function paintStaff(o, editable){
  const host = $("#staffBox"); if(!host) return;
  const list = await loadStaff(o.id);
  const active = list.filter(s=>s.status!=="Чөлөөлөгдсөн").length;
  const expired = list.filter(s=>{ const d=daysLeft(s.healthEnd); return d!==null && d<0; }).length;
  const meta = $("#staffMeta");
  if(meta) meta.textContent = `Нийт ${list.length} ажилтан · ажиллаж байгаа ${active}` +
    (expired ? ` · эрүүл мэндийн үзлэгийн хугацаа дууссан ${expired}` : "") +
    (o.staff ? ` · зарласан орон тоо ${o.staff}` : "");
  if(!list.length){
    host.innerHTML = `<div class="empty">Ажилтан бүртгээгүй байна.${editable?" “Ажилтан нэмэх” товчоор эхлүүлнэ үү.":""}</div>`;
    return;
  }
  host.innerHTML = `
    <table>
      <thead><tr><th>Овог нэр</th><th>Албан тушаал</th><th>Утас</th><th>Ажилд орсон</th><th>Эрүүл мэндийн үзлэг</th><th>Төлөв</th>${editable?"<th></th>":""}</tr></thead>
      <tbody>${list.map((st,i)=>`
        <tr>
          <td><div class="staffcell">
            ${st.photo ? `<img class="photo34" src="${st.photo}" alt="${esc(st.name)}">` : `<span class="photo34 ph">зураг<br>алга</span>`}
            <span><span class="name">${esc(st.name)}</span>${st.reg?`<div class="reg">РД: ${esc(st.reg)}</div>`:""}</span>
          </div></td>
          <td>${esc(st.pos)}</td>
          <td>${esc(st.phone)||'<span class="note">—</span>'}</td>
          <td>${esc(st.since)||'<span class="note">—</span>'}</td>
          <td>${healthPill(st)}${st.healthEnd?`<div class="reg">${esc(st.healthEnd)}</div>`:""}</td>
          <td><span class="pill ${st.status==="Чөлөөлөгдсөн"?"neutral":"ok"}">${esc(st.status)}</span></td>
          ${editable?`<td><button class="btn ghost sm" data-st="${i}">Засах</button></td>`:""}
        </tr>`).join("")}
      </tbody>
    </table>`;
  if(editable) host.querySelectorAll("[data-st]").forEach(b=>b.onclick=()=>staffForm(o, +b.dataset.st));
}

function staffForm(o, idx){
  const list = staffCache[o.id] || [];
  const isNew = idx===null || idx===undefined;
  const v = isNew ? { name:"",pos:POSITIONS[0],reg:"",phone:"",since:"",health:"",healthEnd:"",status:STAFF_STATUS[0],note:"",photo:"" } : list[idx];
  let photo = v.photo || "";
  openModal(isNew?"Ажилтан нэмэх":"Ажилтны мэдээлэл", `
    <div class="filebox" id="s_photoWrap" style="margin-bottom:16px"></div>
    <div class="two">
      <div class="field"><label>Овог, нэр</label><input id="s_name" value="${esc(v.name)}"></div>
      <div class="field"><label>Албан тушаал</label><select id="s_pos"></select></div>
    </div>
    <div class="two">
      <div class="field"><label>Регистрийн дугаар (заавал биш)</label><input id="s_reg" value="${esc(v.reg)}" placeholder="УБ12345678"></div>
      <div class="field"><label>Утас</label><input id="s_phone" value="${esc(v.phone)}"></div>
    </div>
    <div class="two">
      <div class="field"><label>Ажилд орсон огноо</label><input id="s_since" type="date" value="${esc(v.since)}"></div>
      <div class="field"><label>Төлөв</label><select id="s_status"></select></div>
    </div>
    <div class="two">
      <div class="field"><label>Эрүүл мэндийн дэвтрийн дугаар</label><input id="s_health" value="${esc(v.health)}"></div>
      <div class="field"><label>Үзлэгийн хугацаа дуусах</label><input id="s_healthEnd" type="date" value="${esc(v.healthEnd)}"></div>
    </div>
    <div class="field"><label>Тэмдэглэл</label><textarea id="s_note" rows="2">${esc(v.note)}</textarea></div>
    <p class="note">Регистрийн дугаар нь хүний хувийн мэдээлэл тул зөвхөн шаардлагатай тохиолдолд оруулна.</p>`,
    [
      {label:"Болих", cls:"ghost", act:closeModal},
      ...(isNew ? [] : [{label:"Устгах", cls:"danger", act:async (btn)=>{
        if(!btn.dataset.armed){ btn.dataset.armed="1"; btn.textContent="Устгахыг баталгаажуулах"; return; }
        list.splice(idx,1); await saveStaff(o.id, list, o); closeModal(); paintStaff(o, true); toast("Ажилтныг устгалаа.");
      }}]),
      {label:"Хадгалах", cls:"", act:async ()=>{
        const name = $("#s_name").value.trim();
        if(!name) return toast("Овог нэрийг бөглөнө үү.");
        const data = {
          name, pos:$("#s_pos").value, reg:$("#s_reg").value.trim(), phone:$("#s_phone").value.trim(),
          since:$("#s_since").value, health:$("#s_health").value.trim(), healthEnd:$("#s_healthEnd").value,
          status:$("#s_status").value, note:$("#s_note").value.trim(), photo
        };
        if(isNew) list.push({ id:uid(), ...data, created:today() });
        else Object.assign(list[idx], data);
        await saveStaff(o.id, list, o);
        closeModal(); paintStaff(o, true); toast(isNew?"Ажилтан нэмэгдлээ.":"Мэдээллийг шинэчиллээ.");
      }}
    ]);
  fillSelect($("#s_pos"), POSITIONS, v.pos);
  fillSelect($("#s_status"), STAFF_STATUS, v.status);

  const paintPhoto = () => {
    $("#s_photoWrap").innerHTML = `
      ${photo ? `<img class="photo34 big" src="${photo}" alt="Цээж зураг">` : `<span class="photo34 big ph">3×4<br>цээж зураг</span>`}
      <div>
        <div style="font-size:13px;font-weight:600">Цээж зураг (3×4)</div>
        <div class="note" style="margin-bottom:8px">Ямар ч хэмжээтэй зураг оруулахад 3:4 харьцаагаар голлон тайрч, 300×400 болгож хадгална.</div>
        <div style="display:flex;gap:9px;flex-wrap:wrap">
          <label class="upl" style="padding:6px 12px;font-size:12.5px">${photo?"Зураг солих":"Зураг сонгох"}<input type="file" accept="image/*" id="s_photoUp"></label>
          ${photo?`<button class="btn ghost sm" id="s_photoDel">Зураг устгах</button>`:""}
        </div>
      </div>`;
    $("#s_photoUp").onchange = async e => {
      const f = e.target.files[0]; if(!f || !f.type.startsWith("image/")) return;
      photo = await cropPhoto34(f); paintPhoto(); toast("Зураг бэлэн боллоо. Хадгалахаа мартуузай.");
    };
    if($("#s_photoDel")) $("#s_photoDel").onclick = () => { photo = ""; paintPhoto(); };
  };
  paintPhoto();
}

function exportStaffCSV(o, list){
  if(!list.length) return toast("Бүртгэсэн ажилтан алга.");
  const cols = [["Овог нэр","name"],["Албан тушаал","pos"],["Регистрийн дугаар","reg"],["Утас","phone"],
                ["Ажилд орсон","since"],["Эрүүл мэндийн дэвтэр","health"],["Үзлэг дуусах","healthEnd"],["Төлөв","status"],["Тэмдэглэл","note"]];
  const q = s => `"${String(s ?? "").replace(/"/g,'""')}"`;
  const head = [q("Байгууллага"), ...cols.map(c=>q(c[0]))].join(",");
  const rows = list.map(st=>[q(o.name), ...cols.map(c=>q(st[c[1]]))].join(","));
  downloadBlob("\uFEFF" + [head, ...rows].join("\r\n"), "text/csv;charset=utf-8;", `ajilchid_${o.reg}.csv`);
  toast(`${list.length} ажилтан татагдлаа.`);
}

/* ---------- Форм ---------- */
function orgForm(o){
  const isNew = !o;
  const isAdmin = ME.role==="admin";
  const v = o || { name:"",reg:"",cat:CATS[0],own:OWNERS[0],district:"Хан-Уул",khoroo:1,addr:"",area:"",staff:"",hours:"",lic:"",licEnd:"",dir:"",phone:"",mail:"",since:"",status:"Идэвхтэй",note:"" };
  const body = `
    <div class="two">
      <div class="field"><label>Байгууллагын нэр</label><input id="e_name" value="${esc(v.name)}"></div>
      <div class="field"><label>Улсын бүртгэлийн дугаар</label><input id="e_reg" value="${esc(v.reg)}" ${isAdmin?"":"disabled"}></div>
    </div>
    <div class="two">
      <div class="field"><label>Үйл ажиллагааны чиглэл</label><select id="e_cat"></select></div>
      <div class="field"><label>Өмчийн хэлбэр</label><select id="e_own"></select></div>
    </div>
    <div class="two">
      <div class="field"><label>Хороо</label><select id="e_kh"></select></div>
      <div class="field"><label>Ажиллах цагийн хуваарь</label><input id="e_hours" placeholder="09:00–21:00" value="${esc(v.hours)}"></div>
    </div>
    <div class="field"><label>Дэлгэрэнгүй хаяг</label><input id="e_addr" value="${esc(v.addr)}"></div>
    <div class="two">
      <div class="field"><label>Талбай, м²</label><input id="e_area" type="number" min="0" value="${esc(v.area)}"></div>
      <div class="field"><label>Ажиллагсдын тоо</label><input id="e_staff" type="number" min="0" value="${esc(v.staff)}"></div>
    </div>
    <div class="two">
      <div class="field"><label>Тусгай зөвшөөрлийн дугаар</label><input id="e_lic" value="${esc(v.lic)}"></div>
      <div class="field"><label>Зөвшөөрөл дуусах огноо</label><input id="e_licEnd" type="date" value="${esc(v.licEnd)}"></div>
    </div>
    <div class="two">
      <div class="field"><label>Захирал / эзэмшигч</label><input id="e_dir" value="${esc(v.dir)}"></div>
      <div class="field"><label>Утас</label><input id="e_phone" value="${esc(v.phone)}"></div>
    </div>
    <div class="two">
      <div class="field"><label>И-мэйл</label><input id="e_mail" value="${esc(v.mail)}"></div>
      <div class="field"><label>Үйл ажиллагаа эхэлсэн огноо</label><input id="e_since" type="date" value="${esc(v.since)}"></div>
    </div>
    <div class="two">
      <div class="field"><label>Төлөв</label><select id="e_status" ${isAdmin?"":"disabled"}></select></div>
      ${isNew?`<div class="field"><label>Нууц үг (байгууллага нэвтрэхэд)</label><input id="e_pw" value="1234"></div>`:"<div></div>"}
    </div>
    <div class="field"><label>Тэмдэглэл</label><textarea id="e_note" rows="2">${esc(v.note)}</textarea></div>
    ${isAdmin?"":`<p class="note">Бүртгэлийн дугаар, төлөвийг зөвхөн дүүргийн админ өөрчилнө.</p>`}
  `;
  openModal(isNew?"Шинэ байгууллага бүртгэх":"Мэдээлэл засах", body, [
    {label:"Болих", cls:"ghost", act:closeModal},
    {label:"Хадгалах", cls:"", act:async ()=>{
      const name = $("#e_name").value.trim();
      const reg  = isAdmin ? $("#e_reg").value.trim() : v.reg;
      if(!name || !reg) return toast("Нэр болон бүртгэлийн дугаарыг бөглөнө үү.");
      if(DB.orgs.some(x=>x.reg===reg && x.id!==(o && o.id))) return toast("Энэ бүртгэлийн дугаартай нэгж бүртгэлтэй байна.");
      const data = {
        name, reg, cat:$("#e_cat").value, own:$("#e_own").value, district:"Хан-Уул",
        khoroo:Number($("#e_kh").value), addr:$("#e_addr").value.trim(),
        area:$("#e_area").value, staff:$("#e_staff").value, hours:$("#e_hours").value.trim(),
        since:$("#e_since").value, lic:$("#e_lic").value.trim(), licEnd:$("#e_licEnd").value,
        dir:$("#e_dir").value.trim(), phone:$("#e_phone").value.trim(), mail:$("#e_mail").value.trim(),
        status:isAdmin?$("#e_status").value:v.status, note:$("#e_note").value.trim()
      };
      if(isNew){
        DB.orgs.push({ id:uid(), ...data, appr:"ok", apprAt:today(), apprNote:"", pw:hash($("#e_pw").value||"1234"), created:today(), notices:[] });
      } else {
        Object.assign(o, data);
      }
      await saveDB(); await ensureNotices(); closeModal(); render();
      toast(isNew?"Бүртгэл нэмэгдлээ.":"Мэдээллийг шинэчиллээ.");
    }}
  ]);
  fillSelect($("#e_cat"), CATS, v.cat);
  fillSelect($("#e_own"), OWNERS, v.own);
  fillSelect($("#e_kh"), KHOROOS.map(String), String(v.khoroo));
  fillSelect($("#e_status"), STATUSES, v.status);
}

function pwForm(o){
  openModal("Нууц үг солих", `
    <div class="field"><label>Одоогийн нууц үг</label><input id="p_old" type="password"></div>
    <div class="field"><label>Шинэ нууц үг</label><input id="p_new" type="password"></div>
    <div class="field"><label>Шинэ нууц үг давтах</label><input id="p_new2" type="password"></div>`, [
    {label:"Болих", cls:"ghost", act:closeModal},
    {label:"Нууц үг солих", cls:"", act:async ()=>{
      if(hash($("#p_old").value)!==o.pw) return toast("Одоогийн нууц үг буруу байна.");
      if($("#p_new").value.length<4) return toast("Шинэ нууц үг дор хаяж 4 тэмдэгт байна.");
      if($("#p_new").value!==$("#p_new2").value) return toast("Шинэ нууц үг таарахгүй байна.");
      o.pw = hash($("#p_new").value); await saveDB(); closeModal(); toast("Нууц үг солигдлоо.");
    }}
  ]);
}

/* ---------- Модал ---------- */
function openModal(title, body, buttons){
  $("#modalHost").innerHTML = `
    <div class="modal-bg"><div class="modal">
      <h3>${esc(title)}<button class="x" id="mx">×</button></h3>
      <div class="body">${body}</div>
      <div class="foot">${buttons.map((b,i)=>`<button class="btn ${b.cls}" data-i="${i}">${esc(b.label)}</button>`).join("")}</div>
    </div></div>`;
  $("#mx").onclick = closeModal;
  $("#modalHost").querySelector(".modal-bg").onclick = e => { if(e.target.classList.contains("modal-bg")) closeModal(); };
  $("#modalHost").querySelectorAll(".foot .btn").forEach(btn=>btn.onclick=()=>buttons[+btn.dataset.i].act(btn));
}
function closeModal(){ $("#modalHost").innerHTML=""; }
document.addEventListener("keydown", e => { if(e.key==="Escape") closeModal(); });

/* ---------- CSV ---------- */
function exportCSV(list, filename){
  const cols = [
    ["Байгууллагын нэр","name"],["Улсын бүртгэлийн дугаар","reg"],["Үйл ажиллагааны чиглэл","cat"],["Өмчийн хэлбэр","own"],
    ["Дүүрэг","district"],["Хороо","khoroo"],["Хаяг","addr"],["Талбай (м²)","area"],["Ажиллагсдын тоо (зарласан)","staff"],["Бүртгэсэн ажилтан","staffN"],
    ["Ажиллах цаг","hours"],["Тусгай зөвшөөрөл","lic"],["Зөвшөөрөл дуусах","licEnd"],["Захирал","dir"],
    ["Утас","phone"],["И-мэйл","mail"],["Эхэлсэн огноо","since"],["Төлөв","status"],["Тэмдэглэл","note"],["Бүртгүүлсэн огноо","created"]
  ];
  const q = s => `"${String(s ?? "").replace(/"/g,'""')}"`;
  const head = cols.map(c=>q(c[0])).concat(q("Бүртгэлийн төлөв")).join(",");
  const rows = list.map(o=>cols.map(c=>q(o[c[1]])).concat(q(APPR[o.appr]||"")).join(","));
  downloadBlob("\uFEFF" + [head, ...rows].join("\r\n"), "text/csv;charset=utf-8;", filename);
  toast(`${list.length} мөр татагдлаа.`);
}

/* ---------- Анкет (зурагтай, хэвлэхэд бэлэн) ---------- */
async function downloadAnket(o){
  toast("Анкет бэлтгэж байна…");
  const m = await loadMedia(o.id);
  const stf = await loadStaff(o.id);
  const row = (k,v) => `<tr><th>${esc(k)}</th><td>${v ? esc(v) : "—"}</td></tr>`;
  const html = `<!DOCTYPE html><html lang="mn"><head><meta charset="utf-8">
<title>Анкет — ${esc(o.name)}</title>
<style>
  @page{size:A4;margin:14mm}
  *{box-sizing:border-box}
  body{font-family:"Segoe UI",Arial,sans-serif;color:#15203A;margin:0;padding:18px;font-size:12.5px;line-height:1.5}
  .sheet{max-width:820px;margin:0 auto}
  .head{border-bottom:3px solid #A3801A;padding-bottom:12px;margin-bottom:18px}
  .head .org{font-size:12px;color:#6A7391;letter-spacing:.02em}
  .head h1{font-size:20px;margin:8px 0 4px}
  .head .meta{font-size:12px;color:#6A7391}
  h2{font-size:13.5px;margin:22px 0 8px;padding-bottom:5px;border-bottom:1px solid #D6DAE6}
  table{width:100%;border-collapse:collapse;margin-bottom:6px}
  th,td{border:1px solid #D6DAE6;padding:7px 10px;text-align:left;vertical-align:top}
  th{width:230px;background:#F4F6FB;font-weight:600;color:#4A5474}
  .imgs{display:flex;flex-wrap:wrap;gap:8px}
  .imgs img{width:31%;border:1px solid #D6DAE6;object-fit:cover;aspect-ratio:4/3}
  .lic img{max-width:60%;border:1px solid #D6DAE6}
  .sign{display:flex;justify-content:space-between;margin-top:34px;font-size:12px}
  .sign div{width:45%;border-top:1px solid #15203A;padding-top:6px;color:#4A5474}
  .foot{margin-top:24px;font-size:11px;color:#6A7391;border-top:1px solid #D6DAE6;padding-top:8px}
  @media print{ body{padding:0} .noprint{display:none} }
</style></head><body><div class="sheet">
  <div class="head">
    <div class="org">Хан-Уул дүүрэг · Улаанбаатар хот · Аж ахуйн нэгжийн нэгдсэн бүртгэл</div>
    <h1>Аж ахуйн нэгж, байгууллагын бүртгэлийн анкет</h1>
    <div class="meta">Хэвлэсэн огноо: ${today()} · Бүртгэлийн дугаар: ${esc(o.reg)} · Төлөв: ${esc(APPR[o.appr]||"")}</div>
  </div>

  <h2>1. Үндсэн мэдээлэл</h2>
  <table>
    ${row("Байгууллагын нэр", o.name)}
    ${row("Улсын бүртгэлийн дугаар", o.reg)}
    ${row("Үйл ажиллагааны чиглэл", o.cat)}
    ${row("Өмчийн хэлбэр", o.own)}
    ${row("Үйл ажиллагаа эхэлсэн огноо", o.since)}
    ${row("Үйл ажиллагааны төлөв", o.status)}
  </table>

  <h2>2. Байршил, хүчин чадал</h2>
  <table>
    ${row("Дүүрэг, хороо", `${o.district} дүүрэг, ${o.khoroo}-р хороо`)}
    ${row("Дэлгэрэнгүй хаяг", o.addr)}
    ${row("Үйл ажиллагааны талбай", o.area ? o.area+" м²" : "")}
    ${row("Ажиллагсдын тоо", o.staff)}
    ${row("Ажиллах цагийн хуваарь", o.hours)}
  </table>

  <h2>3. Тусгай зөвшөөрөл</h2>
  <table>
    ${row("Зөвшөөрлийн дугаар", o.lic)}
    ${row("Дуусах огноо", o.licEnd)}
    ${row("Нөхцөл байдал", o.licEnd ? (daysLeft(o.licEnd)<0 ? "Хугацаа дууссан" : "Хүчинтэй, "+daysLeft(o.licEnd)+" хоног үлдсэн") : "Бүртгээгүй")}
  </table>
  ${m.lic && m.lic.data.startsWith("data:image") ? `<div class="lic"><img src="${m.lic.data}" alt="Тусгай зөвшөөрөл"></div>`
    : m.lic ? `<p>Зөвшөөрлийн баримт: ${esc(m.lic.name)} (тусад нь хавсаргав)</p>` : `<p>Зөвшөөрлийн баримт хавсаргаагүй.</p>`}

  <h2>4. Холбоо барих</h2>
  <table>
    ${row("Захирал / эзэмшигч", o.dir)}
    ${row("Утас", o.phone)}
    ${row("И-мэйл", o.mail)}
  </table>

  <h2>5. Байгууллагын зураг</h2>
  ${m.photos.length ? `<div class="imgs">${m.photos.map((p,i)=>`<img src="${p}" alt="Зураг ${i+1}">`).join("")}</div>`
    : `<p>Зураг хавсаргаагүй.</p>`}

  <h2>6. Ажилчдын бүртгэл</h2>
  ${stf.length ? `<table>
    <tr><th style="width:auto;text-align:left">Зураг</th><th style="width:auto;text-align:left">Овог нэр</th><th style="width:auto">Албан тушаал</th><th style="width:auto">Утас</th><th style="width:auto">Ажилд орсон</th><th style="width:auto">Эрүүл мэндийн үзлэг</th><th style="width:auto">Төлөв</th></tr>
    ${stf.map(st=>`<tr><td>${st.photo?`<img src="${st.photo}" style="width:42px;aspect-ratio:3/4;object-fit:cover;border:1px solid #D6DAE6">`:"—"}</td><td>${esc(st.name)}</td><td>${esc(st.pos)}</td><td>${esc(st.phone)||"—"}</td><td>${esc(st.since)||"—"}</td><td>${esc(st.healthEnd)||"—"}</td><td>${esc(st.status)}</td></tr>`).join("")}
  </table><p>Нийт ${stf.length} ажилтан, үүнээс ажиллаж байгаа ${stf.filter(x=>x.status!=="Чөлөөлөгдсөн").length}.</p>` : `<p>Ажилтан бүртгээгүй.</p>`}

  ${o.note ? `<h2>7. Тэмдэглэл</h2><p>${esc(o.note)}</p>` : ""}

  <div class="sign">
    <div>Байгууллагын төлөөлөгч: ................................</div>
    <div>Бүртгэсэн ажилтан: ................................</div>
  </div>
  <div class="foot">Энэ анкет нь Хан-Уул дүүргийн аж ахуйн нэгжийн бүртгэлийн системээс автоматаар үүсгэсэн баримт юм.
  PDF болгохын тулд энэ файлыг браузераар нээж, хэвлэх цонхноос “PDF болгож хадгалах” сонголтыг ашиглана уу.</div>
</div></body></html>`;
  downloadBlob(html, "text/html;charset=utf-8", `anket_${o.reg}_${o.name.replace(/[^\wА-Яа-яӨөҮү]+/g,"_").slice(0,30)}.html`);
  toast("Анкет татагдлаа. Браузераар нээж PDF болгоно.");
}

/* ---------- Эхлүүлэх ---------- */
(async function init(){
  fillSelect($("#rg_cat"), CATS);
  fillSelect($("#rg_own"), OWNERS);
  fillSelect($("#rg_khoroo"), KHOROOS.map(String));
  await loadDB();
  await ensureNotices();
  renderAuthStats();
})();
