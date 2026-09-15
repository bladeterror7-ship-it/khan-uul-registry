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
const KEY = "khanuul_registry_v1";
const ADMIN = { user:"admin", pw:"khanuul2026" };
const CATS = ["Эмийн сан","Баар / паб","Караоке","Ресторан, зоогийн газар","Хүнсний дэлгүүр","Худалдааны төв","Зочид буудал","Гоо сайхны салон","Авто засвар, угаалга","Биллиард, тоглоомын газар","Фитнес, спорт","Боловсролын байгууллага","Эрүүл мэндийн байгууллага","Үйлдвэр","Барилга угсралт","Бусад үйлчилгээ"];
const STATUSES = ["Идэвхтэй","Түр зогссон","Хаагдсан"];
const KHOROOS = Array.from({length:25},(_,i)=>i+1);

/* ============ Туслах ============ */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hash = s => { let h=5381; for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))>>>0; return h.toString(36); };
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today = () => new Date().toISOString().slice(0,10);
function daysLeft(d){ if(!d) return null; return Math.round((new Date(d)-new Date(today()))/86400000); }
function toast(t){ const el=document.createElement("div"); el.className="toast"; el.textContent=t; $("#toastHost").appendChild(el); setTimeout(()=>el.remove(),2600); }
function fillSelect(sel, arr, val){ sel.innerHTML = arr.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(""); if(val) sel.value=val; }

/* ============ Өгөгдөл ============ */
let DB = { orgs: [] };
let ME = null;           // {role:'admin'} эсвэл {role:'org', id}
let saving = false;

function seed(){
  const mk = (name,reg,cat,kh,addr,area,staff,hours,lic,licEnd,dir,phone,mail,since,status)=>({
    id:uid(), name, reg, cat, district:"Хан-Уул", khoroo:kh, addr, area, staff, hours,
    lic, licEnd, dir, phone, mail, since, status, note:"", pw:hash("1234"), created:today()
  });
  return [
    mk("Ай Эм Си Фарм ХХК","6123456","Эмийн сан",3,"Чингисийн өргөн чөлөө 15, Наран төв 1 давхар",48,6,"09:00–21:00","ЭМ-2024/1187","2027-03-01","Б.Оюунчимэг","99112233","imcpharm@mail.mn","2019-05-14","Идэвхтэй"),
    mk("Найт Стар Энтертайнмент ХХК","6234117","Караоке",11,"Хан-Уул 11-р хороо, 120 мянгат, Сүлд төв",210,14,"18:00–02:00","ХУД-2025/0442","2026-09-01","Д.Ганзориг","88445566","nightstar@mail.mn","2021-09-02","Идэвхтэй"),
    mk("Зайсан Паб ХХК","6091834","Баар / паб",15,"Зайсангийн гудамж 4, 1-р байр",95,9,"12:00–00:00","ХУД-2024/0311","2026-10-05","Ч.Тэмүүлэн","94002211","zaisanpub@mail.mn","2018-06-11","Идэвхтэй"),
    mk("Оргил Март ХХК","6455012","Хүнсний дэлгүүр",4,"Яармагийн 2-р гудамж 21",130,11,"08:00–23:00","","","Н.Алтанцэцэг","95778899","orgilmart@mail.mn","2020-02-20","Идэвхтэй"),
    mk("Толгойт Авто Сервис ХХК","6300945","Авто засвар, угаалга",8,"Үйлдвэрийн бүс, 7-р гудамж 12",420,17,"09:00–19:00","","","Ж.Батсайхан","99887744","autoservice@mail.mn","2017-11-30","Түр зогссон"),
    mk("Гоо Чимэг салон","6512207","Гоо сайхны салон",20,"Их наяд 6-р байр 1 тоот",62,5,"10:00–20:00","","","С.Мөнхзул","80223344","goochimeg@mail.mn","2022-04-18","Идэвхтэй")
  ];
}

async function loadDB(){
  try{
    const r = await DBX.get(KEY, true);
    DB = JSON.parse(r.value);
    if(!Array.isArray(DB.orgs)) DB.orgs = [];
  }catch(e){
    DB = { orgs: seed() };
    try{ await saveDB(); }catch(_){}
  }
}
async function saveDB(){
  saving = true;
  try{ await DBX.set(KEY, JSON.stringify(DB), true); }
  catch(e){ toast("Хадгалахад алдаа гарлаа. Дахин оролдоно уу."); throw e; }
  finally{ saving = false; }
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
function readAsData(file){
  return new Promise((res, rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); });
}
function openData(dataUrl, name){
  const bin = atob(dataUrl.split(",")[1]);
  const type = dataUrl.slice(5, dataUrl.indexOf(";"));
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], {type}));
  const a = document.createElement("a"); a.href=url; a.download=name||"file"; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
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
  const n = DB.orgs.length, act = DB.orgs.filter(o=>o.status==="Идэвхтэй").length;
  const kh = new Set(DB.orgs.map(o=>o.khoroo)).size;
  const cat = new Set(DB.orgs.map(o=>o.cat)).size;
  $("#authStats").innerHTML = [
    ["Бүртгэлтэй нэгж", n],["Идэвхтэй үйл ажиллагаатай", act],
    ["Хамрагдсан хороо", kh],["Үйл ажиллагааны чиглэл", cat]
  ].map(([a,b])=>`<div class="stat-row"><span>${a}</span><b class="num">${b}</b></div>`).join("");
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
  if(DB.orgs.some(x=>x.reg===reg)) return authMsg("Энэ бүртгэлийн дугаар аль хэдийн бүртгэгдсэн байна.");
  if($("#rg_pw").value.length<4) return authMsg("Нууц үг дор хаяж 4 тэмдэгт байна.");
  if($("#rg_pw").value !== $("#rg_pw2").value) return authMsg("Нууц үг таарахгүй байна.");
  const o = {
    id:uid(), name:$("#rg_name").value.trim(), reg, cat:$("#rg_cat").value,
    district:"Хан-Уул", khoroo:Number($("#rg_khoroo").value), addr:$("#rg_addr").value.trim(),
    area:"", staff:"", hours:"", lic:"", licEnd:"", dir:"", phone:$("#rg_phone").value.trim(),
    mail:"", since:"", status:"Идэвхтэй", note:"", pw:hash($("#rg_pw").value), created:today()
  };
  DB.orgs.push(o); await saveDB();
  ME = { role:"org", id:o.id }; enterApp(); toast("Бүртгэл үүслээ. Мэдээллээ гүйцээж оруулна уу.");
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
    $("#roleLine").textContent = "Дүүргийн нэгдсэн мэдээллийн сан — бүх байгууллагын мэдээлэл";
    $("#whoBox").innerHTML = `<b>Админ</b>Дүүргийн бүртгэлийн алба`;
    renderAdmin();
  }else{
    const o = DB.orgs.find(x=>x.id===ME.id);
    if(!o){ $("#btnOut").click(); return; }
    $("#roleLine").textContent = "Байгууллагын хуудас — зөвхөн өөрийн мэдээлэл";
    const un = unread(o);
    $("#whoBox").innerHTML = `<b>${esc(o.name)}${un?`<span class="badge">${un} мэдэгдэл</span>`:""}</b>Бүртгэл №${esc(o.reg)}`;
    renderOrg(o);
  }
}

/* ---------- Байгууллагын хуудас ---------- */
function licCountdown(o){
  const d = daysLeft(o.licEnd);
  if(d===null) return `<b style="font-size:19px;padding-top:6px"><span class="pill neutral">Огноо оруулаагүй</span></b><span>Тусгай зөвшөөрөл</span>`;
  if(d<0) return `<b class="num" style="color:var(--bad)">${-d}</b><span>Зөвшөөрөл дууссанаас хойш, хоног</span>`;
  return `<b class="num" style="color:${d<=60?"var(--warn)":"inherit"}">${d}</b><span>Зөвшөөрөл дуусахад үлдсэн хоног</span>`;
}

function renderOrg(o){
  const notices = (o.notices||[]).slice(0,12);
  const un = unread(o);
  $("#view").innerHTML = `
    <div class="panel">
      <h3>Мэдэгдэл ${un?`<span class="badge">${un} шинэ</span>`:""}</h3>
      <div class="body">
        ${notices.length ? notices.map(n=>`
          <div class="notice ${esc(n.kind)}">
            ${n.read?"":'<span class="dot"></span>'}
            <div><div>${esc(n.text)}</div><div class="when">${esc(n.date)}${n.read?"":" · шинэ"}</div></div>
          </div>`).join("") : `<p class="note">Одоогоор мэдэгдэл алга. Тусгай зөвшөөрлийн хугацаа дуусах үед энд автоматаар мэдэгдэнэ.</p>`}
        ${un ? `<button class="btn ghost sm" id="oRead" style="margin-top:8px">Бүгдийг уншсан болгох</button>` : ""}
      </div>
    </div>

    <div class="strip">
      <div><b>${esc(o.khoroo)}</b><span>${esc(o.district)} дүүрэг, дугаар хороо</span></div>
      <div><b class="num">${esc(o.staff||"—")}</b><span>Ажиллагсдын тоо</span></div>
      <div><b class="num">${esc(o.area||"—")}</b><span>Талбай, м²</span></div>
      <div>${licCountdown(o)}</div>
    </div>

    <div class="panel">
      <h3>Тусгай зөвшөөрөл</h3>
      <div class="body">
        <dl class="kv" style="margin-bottom:14px">
          <dt>Зөвшөөрлийн дугаар</dt><dd>${esc(o.lic)||'<span class="note">—</span>'}</dd>
          <dt>Дуусах огноо</dt><dd>${o.licEnd ? esc(o.licEnd)+" &nbsp; "+licPill(o) : '<span class="note">—</span>'}</dd>
        </dl>
        <div class="filebox" id="licBox"><span class="note">Ачаалж байна…</span></div>
        <p class="note" style="margin-top:10px">Зөвшөөрлийн гэрчилгээний зураг эсвэл PDF-ийг байршуулна. Дугаар, огноог “Мэдээлэл засах” хэсгээс оруулна.</p>
      </div>
    </div>

    <div class="panel">
      <h3>Байгууллагын зураг</h3>
      <div class="body">
        <div class="gallery" id="gal"><span class="note">Ачаалж байна…</span></div>
        <div style="margin-top:12px">
          <label class="upl">Зураг нэмэх<input type="file" accept="image/*" multiple id="upPhoto"></label>
        </div>
        <p class="note" style="margin-top:8px">Хамгийн ихдээ 6 зураг. Зургийг автоматаар шахаж хадгална.</p>
      </div>
    </div>

    <div class="panel">
      <h3>Бүртгэлийн мэдээлэл</h3>
      <div class="body">${kvTable(o)}</div>
      <div style="padding:13px 16px;border-top:1px solid var(--line-soft);display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="oEdit">Мэдээлэл засах</button>
        <button class="btn ghost" id="oPw">Нууц үг солих</button>
        <button class="btn ghost" id="oCsv">Өөрийн мэдээллийг татах</button>
      </div>
    </div>
    <p class="note">Таны оруулсан мэдээлэл, зураг дүүргийн бүртгэлийн албанд харагдана. Бусад байгууллага таны мэдээллийг харах боломжгүй.</p>
  `;
  $("#oEdit").onclick = () => orgForm(o);
  $("#oPw").onclick = () => pwForm(o);
  $("#oCsv").onclick = () => exportCSV([o], `bureeddel_${o.reg}.csv`);
  if($("#oRead")) $("#oRead").onclick = async () => {
    (o.notices||[]).forEach(n=>n.read=true); await saveDB(); render();
  };
  paintOrgMedia(o);
}

async function paintOrgMedia(o){
  const m = await loadMedia(o.id);

  // Зөвшөөрлийн баримт
  const box = $("#licBox"); if(!box) return;
  box.innerHTML = m.lic
    ? `${m.lic.data.startsWith("data:image") ? `<img src="${m.lic.data}" alt="Тусгай зөвшөөрөл">` : `<span>📄 ${esc(m.lic.name)}</span>`}
       <div style="display:flex;gap:8px;flex-wrap:wrap">
         <button class="btn ghost sm" id="licGet">Татаж авах</button>
         <button class="btn ghost sm" id="licDel">Устгах</button>
         <label class="upl" style="padding:5px 10px;font-size:13px">Солих<input type="file" accept="image/*,application/pdf" id="licUp"></label>
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
  if($("#licUp")) $("#licUp").onchange = licUpload;
  if($("#licGet")) $("#licGet").onclick = () => openData(m.lic.data, m.lic.name);
  if($("#licDel")) $("#licDel").onclick = async () => { m.lic=null; await saveMedia(o.id,m); paintOrgMedia(o); toast("Баримтыг устгалаа."); };

  // Зургийн цомог
  const gal = $("#gal");
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
    for(const f of files){
      if(!f.type.startsWith("image/")) continue;
      m.photos.push(await shrinkImage(f));
    }
    await saveMedia(o.id, m); paintOrgMedia(o); toast("Зураг хадгалагдлаа.");
  };
}

function statusPill(s){
  const k = s==="Идэвхтэй" ? "ok" : s==="Түр зогссон" ? "warn" : "bad";
  return `<span class="pill ${k}">${esc(s)}</span>`;
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
    ["Байршил", `${o.district} дүүрэг, ${o.khoroo}-р хороо`],
    ["Дэлгэрэнгүй хаяг", o.addr],
    ["Үйл ажиллагааны талбай", o.area ? o.area+" м²" : ""],
    ["Ажиллагсдын тоо", o.staff],
    ["Ажиллах цагийн хуваарь", o.hours],
    ["Тусгай зөвшөөрлийн дугаар", o.lic],
    ["Зөвшөөрөл дуусах огноо", o.licEnd ? `${o.licEnd} &nbsp; ${licPill(o)}` : ""],
    ["Захирал / эзэмшигч", o.dir],
    ["Утас", o.phone],
    ["И-мэйл", o.mail],
    ["Үйл ажиллагаа эхэлсэн", o.since],
    ["Төлөв", statusPill(o.status)],
    ["Тэмдэглэл", o.note],
    ["Бүртгэсэн огноо", o.created]
  ];
  return `<dl class="kv">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${v ? (String(v).includes("<") ? v : esc(v)) : '<span class="note">—</span>'}</dd>`).join("")}</dl>`;
}

/* ---------- Админ хуудас ---------- */
let F = { q:"", cat:"", khoroo:"", status:"", sort:"name", dir:1 };

function renderAdmin(){
  const n = DB.orgs.length;
  const act = DB.orgs.filter(o=>o.status==="Идэвхтэй").length;
  const expiring = DB.orgs.filter(o=>{ const d=daysLeft(o.licEnd); return d!==null && d<=60; }).length;
  const kh = new Set(DB.orgs.map(o=>o.khoroo)).size;

  $("#view").innerHTML = `
    <div class="strip">
      <div><b class="num">${n}</b><span>Нийт бүртгэлтэй нэгж</span></div>
      <div><b class="num">${act}</b><span>Идэвхтэй үйл ажиллагаатай</span></div>
      <div><b class="num">${expiring}</b><span>Зөвшөөрөл дуусах / дууссан</span></div>
      <div><b class="num">${kh}</b><span>Хамрагдсан хороо</span></div>
    </div>

    <div class="toolbar">
      <div class="field" style="flex:2"><label>Хайх</label><input id="fq" placeholder="нэр, бүртгэлийн дугаар, хаяг, захирал" value="${esc(F.q)}"></div>
      <div class="field"><label>Чиглэл</label><select id="fcat"></select></div>
      <div class="field"><label>Хороо</label><select id="fkh"></select></div>
      <div class="field"><label>Төлөв</label><select id="fst"></select></div>
      <button class="btn ghost" id="fclear">Шүүлт цэвэрлэх</button>
      <button class="btn ghost" id="bcsv">CSV татах</button>
      <button class="btn" id="badd">Байгууллага нэмэх</button>
    </div>

    <div class="panel">
      <h3 id="listTitle"></h3>
      <div class="tblwrap" id="tbl"></div>
    </div>

    <div class="panel">
      <h3>Үйл ажиллагааны чиглэлээр</h3>
      <div class="body"><div class="bars" id="byCat"></div></div>
    </div>
    <div class="panel">
      <h3>Хороогоор</h3>
      <div class="body"><div class="bars" id="byKh"></div></div>
    </div>
  `;

  fillSelect($("#fcat"), ["Бүгд", ...CATS], F.cat||"Бүгд");
  fillSelect($("#fkh"), ["Бүгд", ...KHOROOS.map(k=>k+"-р хороо")], F.khoroo ? F.khoroo+"-р хороо" : "Бүгд");
  fillSelect($("#fst"), ["Бүгд", ...STATUSES], F.status||"Бүгд");

  $("#fq").oninput = e => { F.q=e.target.value; paintTable(); };
  $("#fcat").onchange = e => { F.cat = e.target.value==="Бүгд"?"":e.target.value; paintTable(); };
  $("#fkh").onchange  = e => { F.khoroo = e.target.value==="Бүгд"?"":parseInt(e.target.value); paintTable(); };
  $("#fst").onchange  = e => { F.status = e.target.value==="Бүгд"?"":e.target.value; paintTable(); };
  $("#fclear").onclick = () => { F={q:"",cat:"",khoroo:"",status:"",sort:F.sort,dir:F.dir}; renderAdmin(); };
  $("#bcsv").onclick = () => exportCSV(filtered(), "khan_uul_bureeddel.csv");
  $("#badd").onclick = () => orgForm(null);

  paintTable(); paintBars();
}

function filtered(){
  const q = F.q.trim().toLowerCase();
  let list = DB.orgs.filter(o=>{
    if(F.cat && o.cat!==F.cat) return false;
    if(F.khoroo && Number(o.khoroo)!==F.khoroo) return false;
    if(F.status && o.status!==F.status) return false;
    if(q){
      const hay = [o.name,o.reg,o.addr,o.dir,o.phone,o.cat,o.lic].join(" ").toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
  list.sort((a,b)=>{
    let x=a[F.sort]??"", y=b[F.sort]??"";
    if(F.sort==="khoroo"||F.sort==="staff") { x=Number(x)||0; y=Number(y)||0; return (x-y)*F.dir; }
    return String(x).localeCompare(String(y),"mn")*F.dir;
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
        ${th("name","Байгууллага")}${th("cat","Чиглэл")}${th("khoroo","Хороо")}
        <th>Хаяг</th>${th("staff","Ажилтан")}<th>Зөвшөөрөл</th>${th("status","Төлөв")}<th>Холбоо барих</th><th></th>
      </tr></thead>
      <tbody>${list.map(o=>`
        <tr>
          <td><div class="name">${esc(o.name)}</div><div class="reg">№${esc(o.reg)}</div></td>
          <td>${esc(o.cat)}</td>
          <td class="num">${esc(o.khoroo)}</td>
          <td>${esc(o.addr)||'<span class="note">—</span>'}</td>
          <td class="num">${esc(o.staff)||"—"}</td>
          <td>${licPill(o)}</td>
          <td>${statusPill(o.status)}</td>
          <td>${esc(o.dir)}<div class="reg">${esc(o.phone)}</div></td>
          <td><button class="btn ghost sm" data-open="${o.id}">Дэлгэрэнгүй</button></td>
        </tr>`).join("")}
      </tbody>
    </table>`;
  $("#tbl").querySelectorAll("th.sortable").forEach(h=>h.onclick=()=>{
    const k=h.dataset.k; F.dir = (F.sort===k) ? -F.dir : 1; F.sort=k; paintTable();
  });
  $("#tbl").querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>detail(b.dataset.open));
}

function paintBars(){
  const draw = (host, pairs) => {
    const max = Math.max(1, ...pairs.map(p=>p[1]));
    host.innerHTML = pairs.length ? pairs.map(([k,v])=>`
      <div class="barrow"><span>${esc(k)}</span>
        <span class="bartrack"><span class="barfill" style="width:${Math.round(v/max*100)}%"></span></span>
        <i class="num">${v}</i></div>`).join("") : `<p class="note">Мэдээлэл алга.</p>`;
  };
  const count = key => {
    const m = new Map();
    DB.orgs.forEach(o=>m.set(o[key], (m.get(o[key])||0)+1));
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  };
  draw($("#byCat"), count("cat"));
  draw($("#byKh"), count("khoroo").map(([k,v])=>[k+"-р хороо",v]).sort((a,b)=>b[1]-a[1]));
}

function detail(id){
  const o = DB.orgs.find(x=>x.id===id); if(!o) return;
  const nlist = (o.notices||[]).slice(0,6);
  const body = `
    <div id="admMedia"><p class="note">Зураг, баримт ачаалж байна…</p></div>
    ${kvTable(o)}
    <h3 style="font-size:14px;margin:18px 0 8px">Илгээсэн мэдэгдэл</h3>
    ${nlist.length ? nlist.map(n=>`<div class="notice ${esc(n.kind)}"><div><div>${esc(n.text)}</div>
      <div class="when">${esc(n.date)} · ${n.read?"уншсан":"уншаагүй"}</div></div></div>`).join("")
      : `<p class="note">Мэдэгдэл илгээгээгүй байна.</p>`}
  `;
  openModal(o.name, body, [
    {label:"Хаах", cls:"ghost", act:closeModal},
    {label:"Устгах", cls:"danger", act:(btn)=>{
      if(btn.dataset.armed){
        DB.orgs = DB.orgs.filter(x=>x.id!==id);
        DBX.delete(MKEY(id), true).catch(()=>{});
        saveDB().then(()=>{ closeModal(); renderAdmin(); toast("Бүртгэлийг устгалаа."); });
      } else { btn.dataset.armed="1"; btn.textContent="Устгахыг баталгаажуулах"; }
    }},
    {label:"Мэдэгдэл илгээх", cls:"ghost", act:()=>{ closeModal(); noticeForm(o); }},
    {label:"Засах", cls:"", act:()=>{ closeModal(); orgForm(o); }}
  ]);
  paintAdminMedia(o);
}

async function paintAdminMedia(o){
  const m = await loadMedia(o.id);
  const host = $("#admMedia"); if(!host) return;
  host.innerHTML = `
    ${m.lic ? `<div class="filebox" style="margin-bottom:14px">
        ${m.lic.data.startsWith("data:image") ? `<img src="${m.lic.data}" alt="Тусгай зөвшөөрөл">` : `<span>📄 ${esc(m.lic.name)}</span>`}
        <div><div style="font-size:13px">Тусгай зөвшөөрлийн баримт</div>
        <div class="note">Байршуулсан: ${esc(m.lic.at||"—")}</div>
        <button class="btn ghost sm" id="admLicGet" style="margin-top:6px">Татаж авах</button></div>
      </div>` : `<p class="note">Тусгай зөвшөөрлийн баримт байршуулаагүй.</p>`}
    ${m.photos.length ? `<div class="gallery" style="margin-bottom:14px">${m.photos.map((p,i)=>`<div class="shot"><img src="${p}" alt="Зураг ${i+1}"></div>`).join("")}</div>`
      : `<p class="note">Байгууллагын зураг оруулаагүй.</p>`}
  `;
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
      await saveDB(); closeModal(); renderAdmin(); toast("Мэдэгдлийг илгээлээ.");
    }}
  ]);
}

/* ---------- Форм ---------- */
function orgForm(o){
  const isNew = !o;
  const isAdmin = ME.role==="admin";
  const v = o || { name:"",reg:"",cat:CATS[0],district:"Хан-Уул",khoroo:1,addr:"",area:"",staff:"",hours:"",lic:"",licEnd:"",dir:"",phone:"",mail:"",since:"",status:"Идэвхтэй",note:"" };
  const body = `
    <div class="two">
      <div class="field"><label>Байгууллагын нэр</label><input id="e_name" value="${esc(v.name)}"></div>
      <div class="field"><label>Улсын бүртгэлийн дугаар</label><input id="e_reg" value="${esc(v.reg)}" ${isAdmin?"":"disabled"}></div>
    </div>
    <div class="two">
      <div class="field"><label>Үйл ажиллагааны чиглэл</label><select id="e_cat"></select></div>
      <div class="field"><label>Хороо</label><select id="e_kh"></select></div>
    </div>
    <div class="field"><label>Дэлгэрэнгүй хаяг</label><input id="e_addr" value="${esc(v.addr)}"></div>
    <div class="two">
      <div class="field"><label>Талбай, м²</label><input id="e_area" type="number" min="0" value="${esc(v.area)}"></div>
      <div class="field"><label>Ажиллагсдын тоо</label><input id="e_staff" type="number" min="0" value="${esc(v.staff)}"></div>
    </div>
    <div class="two">
      <div class="field"><label>Ажиллах цагийн хуваарь</label><input id="e_hours" placeholder="09:00–21:00" value="${esc(v.hours)}"></div>
      <div class="field"><label>Үйл ажиллагаа эхэлсэн огноо</label><input id="e_since" type="date" value="${esc(v.since)}"></div>
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
      <div class="field"><label>Төлөв</label><select id="e_status" ${isAdmin?"":"disabled"}></select></div>
    </div>
    <div class="field"><label>Тэмдэглэл</label><textarea id="e_note" rows="2">${esc(v.note)}</textarea></div>
    ${isNew?`<div class="field"><label>Нууц үг (байгууллага нэвтрэхэд)</label><input id="e_pw" value="1234"></div>`:""}
    ${isAdmin?"":`<p class="note">Бүртгэлийн дугаар, төлөвийг зөвхөн дүүргийн админ өөрчилнө.</p>`}
  `;
  openModal(isNew?"Шинэ байгууллага бүртгэх":"Мэдээлэл засах", body, [
    {label:"Болих", cls:"ghost", act:closeModal},
    {label:"Хадгалах", cls:"", act:async ()=>{
      const name = $("#e_name").value.trim();
      const reg = isAdmin ? $("#e_reg").value.trim() : v.reg;
      if(!name || !reg) return toast("Нэр болон бүртгэлийн дугаарыг бөглөнө үү.");
      if(DB.orgs.some(x=>x.reg===reg && x.id!==(o&&o.id))) return toast("Энэ бүртгэлийн дугаартай нэгж бүртгэлтэй байна.");
      const data = {
        name, reg, cat:$("#e_cat").value, district:"Хан-Уул", khoroo:Number($("#e_kh").value),
        addr:$("#e_addr").value.trim(), area:$("#e_area").value, staff:$("#e_staff").value,
        hours:$("#e_hours").value.trim(), since:$("#e_since").value, lic:$("#e_lic").value.trim(),
        licEnd:$("#e_licEnd").value, dir:$("#e_dir").value.trim(), phone:$("#e_phone").value.trim(),
        mail:$("#e_mail").value.trim(), status:isAdmin?$("#e_status").value:v.status, note:$("#e_note").value.trim()
      };
      if(isNew) DB.orgs.push({ id:uid(), ...data, pw:hash($("#e_pw").value||"1234"), created:today() });
      else Object.assign(o, data);
      await saveDB(); await ensureNotices(); closeModal(); render(); toast(isNew?"Бүртгэл нэмэгдлээ.":"Мэдээллийг шинэчиллээ.");
    }}
  ]);
  fillSelect($("#e_cat"), CATS, v.cat);
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
    ["Байгууллагын нэр","name"],["Улсын бүртгэлийн дугаар","reg"],["Үйл ажиллагааны чиглэл","cat"],
    ["Дүүрэг","district"],["Хороо","khoroo"],["Хаяг","addr"],["Талбай (м²)","area"],["Ажиллагсдын тоо","staff"],
    ["Ажиллах цаг","hours"],["Тусгай зөвшөөрөл","lic"],["Зөвшөөрөл дуусах","licEnd"],["Захирал","dir"],
    ["Утас","phone"],["И-мэйл","mail"],["Эхэлсэн огноо","since"],["Төлөв","status"],["Тэмдэглэл","note"],["Бүртгэсэн огноо","created"]
  ];
  const q = s => `"${String(s??"").replace(/"/g,'""')}"`;
  const csv = "\uFEFF" + [cols.map(c=>q(c[0])).join(",")]
    .concat(list.map(o=>cols.map(c=>q(o[c[1]])).join(","))).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], {type:"text/csv;charset=utf-8;"}));
  const a = document.createElement("a"); a.href=url; a.download=filename; a.click();
  URL.revokeObjectURL(url);
  toast(`${list.length} мөр татагдлаа.`);
}

/* ---------- Эхлүүлэх ---------- */
(async function init(){
  fillSelect($("#rg_cat"), CATS);
  fillSelect($("#rg_khoroo"), KHOROOS.map(k=>String(k)));
  await loadDB();
  await ensureNotices();
  renderAuthStats();
})();
