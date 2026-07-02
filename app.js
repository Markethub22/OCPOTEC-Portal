/* OCPOTECH Portal - client-side auth + Bank-Transfer Payments
   v9 — Real school portal (not a demo)
*/
const SCHOOL = {
  name: "ONDO CITY POLYTECHNIC",
  shortName: "OCPOTECH",
  tag: "STRENGTHEN THE TECHNOLOGY",
  rc: "1472598",
  address: "Adegoke Street, Arigbabola, Ondo City, Ondo State",
  phone: "08066478440, 08158941068, 08137968539",
  email: "registrarofocpotech@gmail.com",
  bursaryEmail: "ondocitypoly.bursary@gmail.com",
  whatsapp: "2348066478440",
  session: "2026/2027",
};

// Admin emails that receive a notification whenever a payment is recorded
// or confirmed. Uses formsubmit.co (no signup / no backend). The first
// email sent to a new address triggers a one-time activation link that the
// admin must click; subsequent notifications arrive normally.
const ADMIN_EMAILS = [
  "michaelruddy440@gmail.com",
  "registrarofocpotech@gmail.com",
  "olalekanadio8@gmail.com",
];
function notifyAdminOfPayment(rec, stage){
  try {
    const subject = `[OCPOTECH PAYMENT ${String(stage||"NEW").toUpperCase()}] ${rec.label||""} — ${rec.customer?.name||rec.payerName||""} — NGN ${(rec.amount||0).toLocaleString()}`;
    const message =
      `A payment has been ${stage==="confirmed"?"CONFIRMED":"submitted"} on the OCPOTECH portal.\n\n`+
      `Student : ${rec.customer?.name||rec.payerName||"—"}\n`+
      `Email   : ${rec.customer?.email||"—"}\n`+
      `Fee     : ${rec.label||"—"}\n`+
      `Amount  : NGN ${(rec.amount||0).toLocaleString()}\n`+
      `Reference: ${rec.reference||rec.tx_ref||"—"}\n`+
      `Method  : ${rec.method||"Bank Transfer"}\n`+
      `Status  : ${(rec.status||"pending").toUpperCase()}\n`+
      `Date    : ${new Date(rec.date||Date.now()).toLocaleString()}\n\n`+
      `Log in to the OCPOTECH Admin portal to view the proof of payment and confirm.`;
    ADMIN_EMAILS.forEach(addr=>{
      const url = "https://formsubmit.co/ajax/"+encodeURIComponent(addr);
      fetch(url, {
        method: "POST",
        headers: {"Content-Type":"application/json","Accept":"application/json"},
        body: JSON.stringify({
          _subject: subject,
          _template: "table",
          _captcha: "false",
          name: rec.customer?.name||rec.payerName||"OCPOTECH Portal",
          email: rec.customer?.email||"no-reply@ondocitypoly.com.ng",
          message,
        }),
      }).catch(()=>{});
    });
  } catch(_) {}
}

// ---- Fees (no ID card anywhere) ----
const FEES = {
  screening:            { amount: 3250,  label: "Pre-Admission Screening Fee (Jambite)" },
  screening_nonjambite: { amount: 7500,  label: "Pre-Admission Screening Fee (Non-Jambite)" },
  post_utme:            { amount: 3250,  label: "Post-UTME Screening Fee" },
  parttime_form:        { amount: 7500,  label: "Part-Time Application Form (Non-Jambite)" },
  parttime_form_jamb:   { amount: 3250,  label: "Part-Time Application Form (Jambite)" },
  acceptance:           { amount: 30000, label: "Acceptance Fee" },
};

// Faculties → Programmes
const PROGRAMMES = {
  "FACULTY OF HEALTH SCIENCES": [
    "Dental Nursing Science","Orthopedic & Plaster Technology","Health Information Management",
    "Medical Imaging Technology","Environmental Health Technology","Public Health Science","Pharmacy Technology"
  ],
  "FACULTY OF APPLIED SCIENCE": [
    "Computer Science","Science Laboratory Technology (SLT)","Maths & Statistics"
  ],
  "FACULTY OF ARTS & HUMANITIES": [
    "Mass Communication","Public Administration","Criminology & Security Studies","Theatre Art and Media Studies"
  ],
  "FACULTY OF MANAGEMENT SCIENCES": [
    "Accountancy","Banking and Finance","Business Administration","Marketing"
  ],
  "FACULTY OF ENGINEERING": [
    "Mechanical Engineering","Computer Engineering","Electrical/Electronic Engineering","Civil Engineering Technology"
  ],
  "FACULTY OF ENVIRONMENTAL DESIGN AND MANAGEMENT": [
    "Estate Management","Building Technology","Architecture","Quantity Survey"
  ],
};

// Default Tuition fee per programme (admin-editable in Settings -> Tuition).
// This is the TUITION line on the Payment List; other lines are fixed.
const DEFAULT_TUITION = {};
Object.values(PROGRAMMES).flat().forEach(p => { DEFAULT_TUITION[p] = 45000; });

// Default school-fee table per faculty (kept for school-fee compute).
const DEFAULT_FACULTY_FEES = {
  "FACULTY OF HEALTH SCIENCES":                    { indigene:70000, nonIndigene:75000, pt_nd:50000, pt_hnd:60000 },
  "FACULTY OF APPLIED SCIENCE":                    { indigene:70000, nonIndigene:75000, pt_nd:50000, pt_hnd:60000 },
  "FACULTY OF ARTS & HUMANITIES":                  { indigene:60000, nonIndigene:65000, pt_nd:45000, pt_hnd:45000 },
  "FACULTY OF MANAGEMENT SCIENCES":                { indigene:60000, nonIndigene:65000, pt_nd:45000, pt_hnd:45000 },
  "FACULTY OF ENGINEERING":                        { indigene:70000, nonIndigene:75000, pt_nd:50000, pt_hnd:60000 },
  "FACULTY OF ENVIRONMENTAL DESIGN AND MANAGEMENT":{ indigene:70000, nonIndigene:75000, pt_nd:50000, pt_hnd:60000 },
};

const DEFAULT_BANK = {
  bankName: "ZENITH BANK PLC",
  accountName: "ONDO CITY POLYTECHNIC",
  accountNumber: "1015590180",
};

function facultyOfProgramme(prog){
  for(const f in PROGRAMMES){ if(PROGRAMMES[f].includes(prog)) return f; }
  return null;
}
function computeSchoolFee(scr){
  const fees = (DB.settings.facultyFees) || DEFAULT_FACULTY_FEES;
  const fac = scr.faculty || facultyOfProgramme(scr.course);
  if(!fac || !fees[fac]) return 0;
  const row = fees[fac];
  const mode = (scr.mode||"").toLowerCase();
  if(mode.includes("part") && /hnd/i.test(scr.level||"")) return row.pt_hnd;
  if(mode.includes("part")) return row.pt_nd;
  const isIndigene = /ondo/i.test(scr.state||"");
  return isIndigene ? row.indigene : row.nonIndigene;
}
function tuitionForCourse(course){
  const t = (DB.settings.tuition) || DEFAULT_TUITION;
  return t[course] || 45000;
}
// Tuition fee = the faculty fee table value, based on the student's profile:
//  - Full-time: Indigene (Ondo State) vs Non-Indigene
//  - Part-time: ND vs HND (no Indigene/Non-Indigene for PT)
function computeTuition({faculty, course, state, mode, level}){
  const fees = (DB.settings.facultyFees) || DEFAULT_FACULTY_FEES;
  const fac = faculty || facultyOfProgramme(course);
  if(!fac || !fees[fac]) return tuitionForCourse(course);
  const row = fees[fac];
  const m = (mode||"").toLowerCase();
  if(m.includes("part")){
    return /hnd/i.test(level||"") ? row.pt_hnd : row.pt_nd;
  }
  const isIndigene = /ondo/i.test(state||"");
  return isIndigene ? row.indigene : row.nonIndigene;
}

// ========================================================
// Acceptance Fee breakdown (Acceptance + Instrument fee by faculty)
//   - Default: ₦30,000 acceptance only
//   - Faculty of Health Sciences: + ₦30,000 Medical Instrument  = ₦60,000
//   - Faculty of Engineering:     + ₦20,000 Engineering Instrument = ₦50,000
// ========================================================
function acceptanceBreakdown(faculty){
  const f = (faculty || "").toUpperCase();
  let instrument = 0, label = null;
  if(/HEALTH/.test(f)){ instrument = 30000; label = "MEDICAL INSTRUMENT FEE"; }
  else if(/ENGINEERING/.test(f)){ instrument = 20000; label = "ENGINEERING INSTRUMENT FEE"; }
  return { acceptance: 30000, instrument, label, total: 30000 + instrument };
}
function facultyOfUser(u){
  if(!u) return "";
  return u.faculty || (u.profile && u.profile.faculty) ||
    facultyOfProgramme(u.course || (u.profile && u.profile.course)) || "";
}
function acceptanceTotalFor(u){ return acceptanceBreakdown(facultyOfUser(u)).total; }

// ========================================================
// Screening aggregate score (max 100)
//   O'Level: 5 grades -> points (A1=8 ... F9=0), +10 bonus for single sitting (max 50)
//   JAMB: (jamb_score / 400) * 50 (max 50)
// ========================================================
const GRADE_POINTS = { A1:8, B2:7, B3:6, C4:5, C5:4, C6:3, D7:2, E8:1, F9:0 };
function gradePoints(g){
  if(!g) return 0;
  const k = g.toString().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return Object.prototype.hasOwnProperty.call(GRADE_POINTS, k) ? GRADE_POINTS[k] : 0;
}
function computeAggregate(scr){
  const olevel = scr.olevel || [];
  let oLevelGradeTotal = 0, used = 0;
  for(const r of olevel){
    if(used >= 5) break;
    // Only count a REAL, recognised grade. "N/A", blank or unknown counts for nothing.
    const raw = (r.grade1 || r.grade || "").toString().trim().toUpperCase();
    const valid = raw && raw !== "N/A" && Object.prototype.hasOwnProperty.call(GRADE_POINTS, raw.replace(/[^A-Z0-9]/g, ""));
    if(valid){ oLevelGradeTotal += gradePoints(raw); used++; }
  }
  // No valid O'Level results entered => no screening grade at all (score = 0).
  if(used === 0){
    return { oLevelGradeTotal: 0, sittingBonus: 0, oLevelTotal: 0, jambPoints: 0, aggregate: 0, numSittings: 0 };
  }
  const sit = (scr.olevelSitting || scr.sitting || "1st Sitting").toString().toLowerCase();
  const m = sit.match(/(\d+)/);
  let numSittings = m ? parseInt(m[1], 10) : (sit.includes("two") ? 2 : 1);
  const sittingBonus = numSittings === 1 ? 10 : 0;
  const oLevelTotal = oLevelGradeTotal + sittingBonus;
  const jambScore = Number(scr.jambScore) || 0;
  const jambPoints = scr.jamb ? Math.round((jambScore / 400) * 50 * 100) / 100 : 0;
  const aggregate = Math.round(oLevelTotal + jambPoints);
  return { oLevelGradeTotal, sittingBonus, oLevelTotal, jambPoints, aggregate, numSittings };
}


// ========================================================
// PBKDF2 password hashing (client-side)
// ========================================================
const PBKDF_ITER = 150000;
function _b2h(buf){return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");}
function _h2b(hex){const a=new Uint8Array(hex.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(hex.substr(i*2,2),16);return a;}
async function hashPassword(password, saltHex){
  const salt = saltHex ? _h2b(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), {name:"PBKDF2"}, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2", salt, iterations:PBKDF_ITER, hash:"SHA-256"}, key, 256);
  return { salt: saltHex || _b2h(salt), hash: _b2h(bits), iter: PBKDF_ITER };
}
async function verifyPassword(password, stored){
  if(!stored) return false;
  if(typeof stored === "string"){
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
    return _b2h(b) === stored;
  }
  const { hash } = await hashPassword(password, stored.salt);
  return hash === stored.hash;
}

// ========================================================
// Auto matric number: OCP/<sessionYear>/0001  (used only when admin assigns)
// ========================================================
function _sessionYear(){
  const s = (DB.settings.session || SCHOOL.session);
  return s.split("/")[0];
}
function nextMatric(){
  const yr = _sessionYear();
  const key = `ocp_matseq_${yr}`;
  const n = (parseInt(localStorage.getItem(key)||"0",10))+1;
  localStorage.setItem(key, String(n));
  return `OCP/${yr}/${String(n).padStart(4,"0")}`;
}

// ========================================================
// Asset Store — keeps base64 images (passports, docs) OUT of
// the JSON blobs that get written on every mutation.  This fixes
// the QuotaExceededError when admin approves applications.
// ========================================================
const Assets = {
  prefix: "ocp_asset_",
  put(key, dataUrl){
    if(!dataUrl) return null;
    try { localStorage.setItem(this.prefix + key, dataUrl); return key; }
    catch(e){
      // Quota hit – try to drop the oldest assets then retry.
      this._evict();
      try { localStorage.setItem(this.prefix + key, dataUrl); return key; }
      catch(_){ console.warn("Asset save failed", e); return null; }
    }
  },
  get(key){
    if(!key) return null;
    if(typeof key === "string" && key.startsWith("data:")) return key; // legacy
    return localStorage.getItem(this.prefix + key) || null;
  },
  drop(key){ if(key) localStorage.removeItem(this.prefix + key); },
  _evict(){
    // Drop assets older than 30 days (best-effort).
    const keys = []; for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.startsWith(this.prefix)) keys.push(k); }
    keys.slice(0, Math.max(1, Math.floor(keys.length*0.2))).forEach(k=>localStorage.removeItem(k));
  }
};
// Helper for callers: turn a dataURL into a stored asset id and return the id.
function _storeAssetIfNeeded(maybeDataUrl, idHint){
  if(!maybeDataUrl) return null;
  if(typeof maybeDataUrl !== "string") return null;
  if(!maybeDataUrl.startsWith("data:")) return maybeDataUrl; // already an id
  const id = (idHint||"img") + "_" + Math.random().toString(36).slice(2,10);
  return Assets.put(id, maybeDataUrl);
}

// ========================================================
// DB (localStorage)
// ========================================================
function _store(key, def){
  return {
    get(){ try{ return JSON.parse(localStorage.getItem(key)) ?? def; }catch(e){ return def; } },
    set(v){
      try { localStorage.setItem(key, JSON.stringify(v)); }
      catch(e){
        // Defensive: clear stale assets and retry once.
        Assets._evict();
        localStorage.setItem(key, JSON.stringify(v));
      }
    },
  };
}
const DB = {
  _users:    _store("ocp_users", []),
  _pays:     _store("ocp_payments", []),
  _apps:     _store("ocp_apps", []),
  _scr:      _store("ocp_screenings", []),
  _bio:      _store("ocp_biodata", {}),
  _courses:  _store("ocp_courses", []),
  _reg:      _store("ocp_registrations", []),
  _fees:     _store("ocp_feetypes", []),
  _inv:      _store("ocp_invoices", []),
  _notices:  _store("ocp_notices", []),
  _gallery:  _store("ocp_gallery", []),
  _anthem:   _store("ocp_anthem", null),
  _settings: _store("ocp_settings", {
    session: "2026/2027",
    schoolName: SCHOOL.name, rc: SCHOOL.rc,
    address: SCHOOL.address, phone: SCHOOL.phone,
    email: SCHOOL.email, bursaryEmail: SCHOOL.bursaryEmail,
    whatsapp: SCHOOL.whatsapp,
    bank: DEFAULT_BANK,
    facultyFees: DEFAULT_FACULTY_FEES,
    tuition: DEFAULT_TUITION,
    messages: {},
    admissionStart: "", admissionEnd: "",
  }),
  _pwdResets:_store("ocp_pwd_resets", []),

  get users(){ return this._users.get(); }, set users(v){ this._users.set(v); },
  get payments(){ return this._pays.get(); }, set payments(v){ this._pays.set(v); },
  get applications(){ return this._apps.get(); }, set applications(v){ this._apps.set(v); },
  get screenings(){ return this._scr.get(); }, set screenings(v){ this._scr.set(v); },
  get biodata(){ return this._bio.get(); }, set biodata(v){ this._bio.set(v); },
  get courses(){ return this._courses.get(); }, set courses(v){ this._courses.set(v); },
  get registrations(){ return this._reg.get(); }, set registrations(v){ this._reg.set(v); },
  get feetypes(){ return this._fees.get(); }, set feetypes(v){ this._fees.set(v); },
  get invoices(){ return this._inv.get(); }, set invoices(v){ this._inv.set(v); },
  get notices(){ return this._notices.get(); }, set notices(v){ this._notices.set(v); },
  get gallery(){ return this._gallery.get(); }, set gallery(v){ this._gallery.set(v); },
  get anthem(){ return this._anthem.get(); }, set anthem(v){ this._anthem.set(v); },
  get settings(){ return this._settings.get(); }, set settings(v){ this._settings.set(v); },
  get pwdResets(){ return this._pwdResets.get(); }, set pwdResets(v){ this._pwdResets.set(v); },
};

// Ensure new settings keys exist when older saved settings are loaded
(function _ensureSettings(){
  const s = DB.settings;
  let changed = false;
  if(!s.bank){ s.bank = DEFAULT_BANK; changed = true; }
  if(!s.bursaryEmail){ s.bursaryEmail = SCHOOL.bursaryEmail; changed = true; }
  if(!s.whatsapp){ s.whatsapp = SCHOOL.whatsapp; changed = true; }
  if(!s.tuition){ s.tuition = DEFAULT_TUITION; changed = true; }
  if(!s.messages){ s.messages = {}; changed = true; }
  if(typeof s.admissionStart === "undefined"){ s.admissionStart = ""; changed = true; }
  if(typeof s.admissionEnd === "undefined"){ s.admissionEnd = ""; changed = true; }
  if(changed) DB.settings = s;
})();

// ========================================================
// Editable messages – set by admin in Settings, read by pages.
// applyMessages() looks for elements with [data-msg="KEY"] and
// replaces innerText (or innerHTML for *_html keys).
// ========================================================
function getMsg(key, fallback){
  const m = (DB.settings && DB.settings.messages) || {};
  const v = m[key];
  return (v===undefined || v===null || v==="") ? (fallback||"") : v;
}
function applyMessages(){
  try{
    document.querySelectorAll("[data-msg]").forEach(el=>{
      const k = el.getAttribute("data-msg");
      const fb = el.getAttribute("data-msg-default") || el.innerHTML;
      const v = getMsg(k, fb);
      if(/_html$/.test(k)) el.innerHTML = v; else el.textContent = v;
    });
  }catch(e){}
}
// Stable per-student short hash (used for letter ref numbers, etc.)
function stableHash4(str){
  str = String(str||"");
  let h = 0; for(let i=0;i<str.length;i++){ h = ((h<<5)-h + str.charCodeAt(i))|0; }
  return String(Math.abs(h)).slice(-4).padStart(4,"0");
}

// seed admin + defaults
(async function seed(){
  const admins = [
    {email:"michaelruddy440@gmail.com", name:"Michael Ruddy"},
    {email:"registrarofocpotech@gmail.com", name:"Registrar OCPOTECH"},
    {email:"olalekanadio8@gmail.com", name:"Olalekan Adio"},
  ];
  for(const a of admins){
    const u = DB.users;
    if(!u.find(x=>x.email.toLowerCase()===a.email.toLowerCase())){
      const h = await hashPassword("admin123");
      const arr = DB.users;
      arr.push({id:"u_"+Date.now()+"_"+Math.random().toString(36).slice(2,6), name:a.name, email:a.email, password:h, role:"admin", createdAt:Date.now(), mustChangePwd:true});
      DB.users = arr;
    }
  }
  // Purge legacy generic admin accounts from existing DB
  const legacyEmails = ["admin@ocpotech.edu.ng", "admin@ocp.edu.ng", "admin"];
  const cleaned = DB.users.filter(x=>!legacyEmails.includes(x.email));
  if(cleaned.length !== DB.users.length) DB.users = cleaned;
  if(!DB.feetypes.length){
    DB.feetypes = [
      {id:"ft_acc", name:"Acceptance Fee", amount:30000, applies:"fresh", session:"2026/2027"},
      {id:"ft_sch", name:"School Fees",    amount:87500, applies:"both",  session:"2026/2027"},
      {id:"ft_crs", name:"Course Form",    amount:2500,  applies:"both",  session:"2026/2027"},
      {id:"ft_lib", name:"Library Fee",    amount:1500,  applies:"both",  session:"2026/2027"},
    ];
  }
  if(!DB.courses.length){
    DB.courses = [
      {id:"c1", code:"COM 211", title:"Data Structures",     units:3, dept:"Computer Science", level:"ND II", semester:"First", open:true},
      {id:"c2", code:"COM 213", title:"Web Development",     units:3, dept:"Computer Science", level:"ND II", semester:"First", open:true},
      {id:"c3", code:"GNS 201", title:"Communication Skills",units:2, dept:"General",          level:"ND II", semester:"First", open:true},
      {id:"c4", code:"MTH 211", title:"Discrete Mathematics",units:3, dept:"Computer Science", level:"ND II", semester:"First", open:true},
    ];
  }
})();

// ========================================================
// Auth
// ========================================================
const Auth = {
  current(){ try{ return JSON.parse(sessionStorage.getItem("ocp_session")||"null"); }catch(e){return null;} },
  setCurrent(u){ sessionStorage.setItem("ocp_session", JSON.stringify(u)); },
  logout(){ sessionStorage.removeItem("ocp_session"); location.href="login.html"; },

  async signup({name,email,password,role,course,level}){
    const users = DB.users;
    if(users.find(u=>u.email.toLowerCase()===email.toLowerCase())) throw new Error("Email already registered.");
    const u = {id:"u_"+Date.now(),name,email,password:await hashPassword(password),role:role||"applicant",matric:null,course,level,createdAt:Date.now(),profile:{},status:"active",mustChangePwd:false};
    users.push(u); DB.users = users;
    const {password:_, ...safe} = u; Auth.setCurrent(safe);
    return safe;
  },

  async login(email, password){
    const u = DB.users.find(x=>x.email.toLowerCase()===email.toLowerCase());
    if(!u) throw new Error("No account with that email.");
    if(u.status==="suspended") throw new Error("Account suspended. Contact admin.");
    if(!(await verifyPassword(password, u.password))) throw new Error("Wrong password.");
    const {password:_, ...safe} = u; Auth.setCurrent(safe);
    return safe;
  },

  // Unified student login: JAMB No (jambite full/part-time) OR Application No (non-jambite or PT) + First Name.
  loginStudent(idNumber, firstName){
    const id = (idNumber||"").trim().toUpperCase();
    const fn = (firstName||"").trim().toLowerCase();
    if(!id || !fn) throw new Error("Enter your JAMB / Application No. and first name.");
    const scr = (DB.screenings||[]).find(s=>{
      const j = (s.jamb||"").toUpperCase();
      const a = (s.id||"").toUpperCase();
      return j===id || a===id;
    });
    if(!scr) throw new Error("No record found for that JAMB / Application Number.");
    const scrFirst = (scr.name||scr.firstName||"").trim().split(/\s+/)[0].toLowerCase();
    if(scrFirst !== fn) throw new Error("First name does not match our records.");

    const linkedUser = DB.users.find(u=>{
      if(!u) return false;
      if(u.profile && u.profile.scrId === scr.id) return true;
      if((u.email||"").toLowerCase() === (scr.email||"").toLowerCase()) return true;
      return false;
    });
    if(linkedUser){
      const {password:_p, ...safe} = linkedUser; Auth.setCurrent(safe);
      return { user: safe, screening: scr, returning: true };
    }
    const safe = {
      id: "scr_"+scr.id,
      name: scr.name,
      email: scr.email,
      role: "applicant_screening",
      jamb: scr.jamb || null,
      appNo: /^PT-/.test(scr.id||"") || !scr.jamb ? scr.id : null,
      scrId: scr.id,
      status: scr.status,
      matric: scr.matric || null,
      course: scr.course || null,
      mode: scr.mode || "Full-Time",
      gender: scr.gender || null,
      level: scr.level || "ND I",
    };
    Auth.setCurrent(safe);
    return { user: safe, screening: scr, returning: false };
  },
  loginFreshScreening(jamb, firstName){ return Auth.loginStudent(jamb, firstName); },

  async loginReturning(matric, password){
    const m = (matric||"").trim().toUpperCase();
    const u = DB.users.find(x=>(x.matric||"").toUpperCase()===m);
    if(!u) throw new Error("Account not found. Contact ICT Unit with your Matric No.");
    if(u.status==="suspended") throw new Error("Account suspended. Contact admin.");
    if(!(await verifyPassword(password, u.password))) throw new Error("Wrong password.");
    const {password:_, ...safe} = u; Auth.setCurrent(safe);
    return safe;
  },

  require(allowedRoles){
    const u = Auth.current();
    if(!u){ location.href="login.html"; return null; }
    if(allowedRoles && !allowedRoles.includes(u.role)){
      alert("Access denied for your role.");
      location.href = "dashboard.html"; return null;
    }
    return u;
  },

  updateProfile(patch){
    const me = Auth.current(); if(!me) return;
    const users = DB.users;
    const i = users.findIndex(x=>x.id===me.id);
    if(i>-1){
      users[i] = {...users[i], ...patch, profile:{...users[i].profile, ...(patch.profile||{})}};
      DB.users = users;
      const {password:_, ...safe} = users[i]; Auth.setCurrent(safe);
    }
  },

  async changePassword(newPassword){
    const me = Auth.current(); if(!me) return;
    const users = DB.users;
    const i = users.findIndex(x=>x.id===me.id);
    if(i>-1){
      users[i].password = await hashPassword(newPassword);
      users[i].mustChangePwd = false;
      DB.users = users;
      const {password:_, ...safe} = users[i]; Auth.setCurrent(safe);
    }
  },

  // ----- Forgot password (mail-based) -----
  async requestPasswordReset(emailOrMatric){
    const k = (emailOrMatric||"").trim().toLowerCase();
    if(!k) throw new Error("Enter your email or matric number.");
    const u = DB.users.find(x=>(x.email||"").toLowerCase()===k || (x.matric||"").toLowerCase()===k);
    if(!u) throw new Error("No account found.");
    const code = Math.random().toString(36).slice(2,8).toUpperCase();
    const reset = { id:"r_"+Date.now(), userId:u.id, code, createdAt:Date.now(), used:false };
    const all = DB.pwdResets; all.push(reset); DB.pwdResets = all;
    // Open mail client with the reset code to send to the school admin / user
    const subject = encodeURIComponent("OCPOTECH Password Reset Request");
    const body    = encodeURIComponent(
      `A password reset has been requested for ${u.name} (${u.email}).\n\n` +
      `Reset code: ${code}\n\n` +
      `Use this code on the reset-password page within 30 minutes.`
    );
    const adminMail = DB.settings.email || SCHOOL.email;
    window.open(`mailto:${u.email}?cc=${adminMail}&subject=${subject}&body=${body}`, "_blank");
    return { code, email: u.email };
  },
  async confirmPasswordReset(emailOrMatric, code, newPassword){
    const k = (emailOrMatric||"").trim().toLowerCase();
    const u = DB.users.find(x=>(x.email||"").toLowerCase()===k || (x.matric||"").toLowerCase()===k);
    if(!u) throw new Error("No account found.");
    const all = DB.pwdResets;
    const r = all.find(x=>x.userId===u.id && x.code===(code||"").toUpperCase() && !x.used && (Date.now()-x.createdAt < 30*60*1000));
    if(!r) throw new Error("Invalid or expired reset code.");
    const users = DB.users; const i = users.findIndex(x=>x.id===u.id);
    users[i].password = await hashPassword(newPassword); users[i].mustChangePwd=false;
    DB.users = users;
    r.used = true; DB.pwdResets = all;
    return true;
  }
};

// ========================================================
// Admin approval workflow
// Approve  => create user account WITHOUT matric, create Acceptance invoice
// Decline  => status "Not Admitted" with reason
// FIX: do NOT duplicate large image payloads (passport, docs) onto user.profile.
//      We only carry small scalar fields + a reference to the screening id.
// ========================================================
async function adminApproveScreening(scrId){
  const list = DB.screenings; const s = list.find(x=>x.id===scrId);
  if(!s) throw new Error("Screening not found.");
  if(!s.name) throw new Error("This application has no name — cannot create a student account.");

  // Migrate any inline base64 passport into the asset store (saves localStorage quota).
  if(s.passport && typeof s.passport === "string" && s.passport.startsWith("data:")){
    const id = _storeAssetIfNeeded(s.passport, s.id);
    if(id){ s.passport = id; }
  }
  // Drop heavy doc blobs from the screening record (they were just attached for review).
  ["docBirth","docOlevel","docJamb","docState","docOthers"].forEach(k=>{
    if(s[k] && typeof s[k]==="string" && s[k].length > 800){
      const id = _storeAssetIfNeeded(s[k], s.id+"_"+k);
      if(id) s[k] = id;
    }
  });

  if(!s.email){
    const slug = (s.name||"student").toLowerCase().replace(/[^a-z0-9]+/g,".").replace(/^\.+|\.+$/g,"");
    s.email = `${slug}.${(s.jamb||s.id||Date.now()).toString().toLowerCase().replace(/[^a-z0-9]+/g,"")}@ocpotech.edu.ng`;
  }
  const users = DB.users;
  // Each applicant is identified by their unique screening id. Match an existing
  // account ONLY if it was created from THIS same screening — never collapse two
  // different applicants into one student just because they share an email.
  let user = users.find(u=>u.profile && u.profile.scrId===s.id);
  // If two applicants happen to share an email, keep their accounts distinct.
  const emailLc = (s.email||"").toLowerCase();
  if(!user && emailLc && users.some(u=>(u.email||"").toLowerCase()===emailLc)){
    const at = s.email.indexOf("@");
    s.email = at>0 ? s.email.slice(0,at)+"+"+String(s.id).toLowerCase().replace(/[^a-z0-9]+/g,"")+s.email.slice(at) : s.email;
  }
  const firstName = ((s.name||s.firstName||"student").trim().split(/\s+/)[0]||"student").toLowerCase();
  if(!user){
    user = {
      id:"u_"+Date.now()+"_"+Math.random().toString(36).slice(2,7), name:s.name, email:s.email,
      password: await hashPassword(firstName),
      role:"fresh", matric: s.matric || null,
      course:s.course, faculty:s.faculty,
      level: s.level || "ND I",
      gender: s.gender || null,
      createdAt:Date.now(), status:"active",
      mustChangePwd:true,
      // PROFILE STORES ONLY LIGHT, SCALAR DATA – no big base64 blobs.
      profile:{
        jamb: s.jamb, jambScore: s.jambScore||null, phone:s.phone,
        scrId:s.id, state:s.state, mode:s.mode||"Full-Time",
        gender: s.gender || null,
        appNo: /^PT-/i.test(s.id||"") || !s.jamb ? s.id : null
      }
    };
    users.push(user);
  } else {
    user.role = (user.role==="admin"?user.role:"fresh");
    user.course = s.course; user.faculty = s.faculty;
    user.gender = s.gender || user.gender;
    user.mustChangePwd = true;
    user.status = "active";
    user.profile = {
      ...(user.profile||{}),
      jamb:s.jamb, jambScore:s.jambScore||null, phone:s.phone,
      scrId:s.id, state:s.state, mode:s.mode||"Full-Time",
      gender: s.gender || null,
      appNo: /^PT-/i.test(s.id||"") || !s.jamb ? s.id : null
    };
    user.password = await hashPassword(firstName);
  }
  DB.users = users;

  // Auto Acceptance Fee invoice (includes faculty instrument fee if any)
  const accBd = acceptanceBreakdown(s.faculty || facultyOfProgramme(s.course));
  let inv = (DB.invoices||[]).find(i=>i.userId===user.id && i.label==="Acceptance Fee" && i.status==="pending");
  if(!inv){
    inv = {
      id:"INV-"+Date.now(), userId:user.id,
      label:"Acceptance Fee", amount: accBd.total,
      breakdown: accBd,
      session: DB.settings.session, status:"pending",
      createdAt: Date.now(), note:"Auto-generated on admission approval."
    };
    const invs = DB.invoices; invs.push(inv); DB.invoices = invs;
  }
  // School Fees invoice
  try {
    const sfAmt = computeSchoolFee(s);
    const alreadySf = (DB.invoices||[]).some(i=>i.userId===user.id && /^School Fees/.test(i.label) && i.status==="pending");
    if(sfAmt>0 && !alreadySf){
      const inv2 = {
        id:"INV-"+(Date.now()+1), userId:user.id,
        label:"School Fees ("+(s.faculty||"")+")", amount:sfAmt,
        session: DB.settings.session, status:"pending",
        createdAt: Date.now(),
        note:`Computed for ${/ondo/i.test(s.state||"")?"Ondo State indigene":"non-indigene"} student.`
      };
      DB.invoices = [...DB.invoices, inv2];
    }
  } catch(err){ console.warn("School fee invoice skipped:", err); }

  s.status = "Admitted - Awaiting Acceptance Fee";
  s.admittedAt = Date.now();
  s.declineReason = null;
  DB.screenings = list;
  return { user, invoice: inv };
}

async function adminAssignMatric(idNumber, matric){
  const id = (idNumber||"").trim().toUpperCase();
  const list = DB.screenings;
  const s = list.find(x=>((x.jamb||"").toUpperCase()===id) || ((x.id||"").toUpperCase()===id));
  if(!s) throw new Error("No applicant found for "+idNumber);
  const users = DB.users;
  const u = users.find(x=>(x.profile && x.profile.scrId===s.id) || (x.email||"").toLowerCase()===(s.email||"").toLowerCase());
  if(!u) throw new Error("No user account — approve the screening first.");
  u.matric = matric;
  u.role = "returning";
  s.matric = matric;
  DB.users = users; DB.screenings = list;
  return { user:u, screening:s };
}

async function adminBulkAssignMatric(file){
  let rows = [];
  const name = (file.name||"").toLowerCase();
  if(name.endsWith(".xlsx") || name.endsWith(".xls")){
    if(typeof XLSX === "undefined") throw new Error("Excel reader not loaded.");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, {type:"array"});
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, {defval:""});
  } else { rows = parseCSV(await file.text()); }
  let ok=0, fail=[];
  for(const r of rows){
    const id = (r.jamb || r.JAMB || r["JAMB No"] || r.appNo || r["Application No"] || "").toString();
    const mat = (r.matric || r.Matric || r["Matric No"] || "").toString();
    if(!id || !mat){ fail.push(r); continue; }
    try{ await adminAssignMatric(id, mat); ok++; }catch(e){ fail.push({id, error:e.message}); }
  }
  return { ok, fail };
}
function adminDeclineScreening(scrId, reason){
  const list = DB.screenings; const s = list.find(x=>x.id===scrId);
  if(!s) throw new Error("Screening not found.");
  s.status = "Not Admitted";
  s.declineReason = reason || "Not stated.";
  s.declinedAt = Date.now();
  DB.screenings = list; return s;
}

function markRegistered(userId){
  const users = DB.users; const u = users.find(x=>x.id===userId);
  if(u){ u.role = "returning"; u.registered = true; DB.users = users; }
  const list = DB.screenings;
  const s = list.find(x=>x.email && u && x.email.toLowerCase()===u.email.toLowerCase());
  if(s){ s.status = "Registered Student"; DB.screenings = list; }
}

// ========================================================
// PAYMENT FLOW — Bank Transfer ONLY
// Workflow:
//   1) Student opens payment page with school bank details + reference (JAMB/AppNo).
//   2) Student transfers, uploads proof (image / pdf), enters name on account.
//   3) Click "I have made the payment" -> we:
//        - record payment status = "pending"
//        - mail proof to bursary + admin
//        - open WhatsApp prefilled message
//        - start 10-min countdown
//   4) If admin approves before 10 min -> status="paid", student gets confirm email.
//   5) If 10 min elapses -> page shows "Admin is checking, please wait".
// Payments are IDEMPOTENT: once a fee is paid/pending it cannot be paid again.
// ========================================================
function _recordPayment(rec){ const a=DB.payments; a.push(rec); DB.payments=a; notifyAdminOfPayment(rec,"new"); return rec; }

function userReference(){
  const me = Auth.current() || {};
  return (me.jamb || me.profile?.jamb || me.appNo || me.profile?.appNo || me.scrId || me.matric || "OCP-"+Date.now()).toString();
}

function _findExistingPayment(userId, feeKey){
  return (DB.payments||[]).find(p =>
    p.userId===userId && p.feeKey===feeKey &&
    (p.status==="paid" || p.status==="pending")
  );
}

function userPayments(userId){ return DB.payments.filter(p=>p.userId===userId); }
function hasPaid(userId, feeKey){ return userPayments(userId).some(p=>p.feeKey===feeKey && p.status==="paid"); }
function hasPending(userId, feeKey){ return userPayments(userId).some(p=>p.feeKey===feeKey && p.status==="pending"); }
function hasPaidLabel(userId, regex){
  return DB.invoices.some(i=>i.userId===userId && i.status==="paid" && regex.test(i.label))
      || DB.payments.some(p=>p.userId===userId && p.status==="paid" && regex.test(p.label||""));
}
function acceptancePaid(userId){ return hasPaid(userId,"acceptance") || hasPaidLabel(userId,/acceptance/i); }
// Kept for back-compat with files that haven't been updated yet; ID card removed
function idCardPaid(){ return true; }

// Main entry — replaces the old Flutterwave `pay()` with a bank-transfer modal.
function pay({feeKey, invoiceId, customAmount, customLabel, customerOverride, onSuccess}){
  const me = Auth.current() || {};
  const fee = feeKey ? FEES[feeKey] : null;
  const amount = customAmount ?? fee?.amount;
  const label  = customLabel  ?? fee?.label  ?? "OCPOTECH Payment";
  const email  = customerOverride?.email || me.email || "guest@ocpotech.edu.ng";
  const name   = customerOverride?.name  || me.name  || "OCPOTECH Guest";
  if(!amount){ alert("No fee amount."); return; }

  // Idempotency check
  if(me.id && feeKey){
    const existing = _findExistingPayment(me.id, feeKey);
    if(existing && existing.status==="paid"){
      toast("This fee is already PAID. You cannot pay again.");
      if(onSuccess) onSuccess(existing);
      return;
    }
    if(existing && existing.status==="pending"){
      toast("This payment is awaiting admin confirmation.");
      _openBankPayModal({fee:{label,amount}, feeKey, invoiceId, name, email, existing, onSuccess});
      return;
    }
  }
  _openBankPayModal({fee:{label,amount}, feeKey, invoiceId, name, email, onSuccess});
}

function _openBankPayModal({fee, feeKey, invoiceId, name, email, existing, onSuccess}){
  const me   = Auth.current() || {};
  const bank = (DB.settings.bank) || DEFAULT_BANK;
  const ref  = existing?.reference || userReference();
  const adminMail = DB.settings.email || SCHOOL.email;
  const bursaryMail = DB.settings.bursaryEmail || SCHOOL.bursaryEmail;
  const wa   = (DB.settings.whatsapp || SCHOOL.whatsapp).replace(/\D/g,"");

  // Remove any existing modal
  const old = document.getElementById("payModal"); if(old) old.remove();
  const m = document.createElement("div");
  m.id = "payModal";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;z-index:9999;padding:24px;overflow:auto";
  m.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:560px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.4);font-family:inherit">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
        <div>
          <h2 style="margin:0;color:#15532a">${fee.label}</h2>
          <p class="sub" style="color:#666;margin:4px 0 0">Amount: <strong>₦${fee.amount.toLocaleString()}</strong></p>
        </div>
        <button id="pmClose" class="btn btn-ghost" style="padding:4px 10px">✕</button>
      </div>
      <div style="margin-top:14px;background:#fff8d6;border:1px solid #f0d878;border-radius:10px;padding:14px;font-size:14px;line-height:1.6">
        <strong>PAYMENT TO ${bank.bankName}</strong><br/>
        <strong>ACCOUNT NAME:</strong> ${bank.accountName}<br/>
        <strong>ACCOUNT NUMBER:</strong> ${bank.accountNumber}<br/>
        <strong>USE AS REFERENCE:</strong> <code>${ref}</code>
      </div>
      <p class="sub" style="margin:10px 0 4px;color:#666">Transfer the exact amount, then upload your proof and click <em>I have made the payment</em>.</p>
      <form id="pmForm">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
          <div><label>Name on your bank account</label>
            <input name="payerName" required value="${name||""}" style="padding:10px;border:1px solid #d2d8d4;border-radius:8px;width:100%"/></div>
          <div><label>Phone (for follow-up)</label>
            <input name="payerPhone" value="${me.profile?.phone||""}" style="padding:10px;border:1px solid #d2d8d4;border-radius:8px;width:100%"/></div>
        </div>
        <div style="margin-top:10px"><label>Upload proof of payment (screenshot or PDF)</label>
          <input name="proof" type="file" accept="image/*,application/pdf" required style="display:block;margin-top:6px"/></div>
        <button class="btn btn-green" type="submit" style="margin-top:14px;width:100%">I have made the payment →</button>
      </form>
      <div id="pmAfter" style="display:none;margin-top:14px"></div>
    </div>`;
  document.body.appendChild(m);
  document.getElementById("pmClose").onclick = ()=> m.remove();

  document.getElementById("pmForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const f = e.target;
    const file = f.proof.files[0];
    const proofKey  = file ? await storeImageAsset(file, "proof_"+Date.now()) : null;
    const rec = existing || {
      id:"p_"+Date.now(), userId: me.id||null, feeKey: feeKey||"custom",
      invoiceId: invoiceId||null, amount: fee.amount, label: fee.label,
      status:"pending", tx_ref:"BT-"+Date.now(), transaction_id:null,
      date: Date.now(),
      customer:{ name, email },
      reference: ref,
      payerName: f.payerName.value, payerPhone: f.payerPhone.value,
      proofKey,
      method: "Bank Transfer",
    };
    if(!existing){ _recordPayment(rec); }
    else { // update existing pending with new proof / payer
      const all = DB.payments; const i = all.findIndex(x=>x.id===existing.id);
      if(i>-1){ all[i] = {...all[i], payerName:rec.payerName, payerPhone:rec.payerPhone, proofKey:rec.proofKey, updatedAt:Date.now()}; DB.payments=all; }
    }

    // Compose mailto (admin + bursary)
    const subject = encodeURIComponent(`[OCPOTECH PAYMENT] ${fee.label} - ${name} - ${ref}`);
    const body    = encodeURIComponent(
      `Dear Bursary / Admin,\n\nA student has made a bank transfer.\n\n`+
      `Student: ${name}\nEmail: ${email}\nReference: ${ref}\n`+
      `Fee: ${fee.label}\nAmount: NGN ${fee.amount.toLocaleString()}\n`+
      `Name on Account: ${rec.payerName}\nPhone: ${rec.payerPhone}\n`+
      `Date: ${new Date().toLocaleString()}\n\n`+
      `Please find proof of payment attached (re-attach from your downloads).\n\n`+
      `-- Sent from the OCPOTECH portal`
    );
    const mailUrl = `mailto:${bursaryMail}?cc=${adminMail}&subject=${subject}&body=${body}`;
    const waText  = encodeURIComponent(
      `Hello OCPOTECH Bursary, I (${rec.payerName}) just paid ${fee.label} (NGN ${fee.amount.toLocaleString()}) ref ${ref}.`
    );
    const waUrl   = `https://wa.me/${wa}?text=${waText}`;

    // Show post-payment panel with countdown
    f.style.display = "none";
    const after = document.getElementById("pmAfter");
    after.style.display = "block";
    after.innerHTML = `
      <div style="background:#eaf6ee;border:1px solid #bcdcc3;border-radius:10px;padding:14px">
        <h3 style="margin:0 0 6px;color:#15532a">✓ Payment notification recorded</h3>
        <p class="sub" style="color:#444;margin:0">Status: <strong>AWAITING ADMIN CONFIRMATION</strong></p>
        <p class="sub" style="color:#444;margin:6px 0 0">Reference: <code>${ref}</code></p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <a href="${mailUrl}" target="_blank" class="btn btn-green">📧 Email proof to Bursary + Admin</a>
        <a href="${waUrl}" target="_blank" class="btn btn-ghost">💬 Notify on WhatsApp</a>
      </div>
      <div id="pmTimer" style="margin-top:14px;text-align:center;font-size:32px;font-weight:700;color:#15532a">10:00</div>
      <p class="sub" style="text-align:center;margin:6px 0 0;color:#666">Admin has 10 minutes to confirm. We'll check automatically.</p>
      <button id="pmDone" class="btn btn-ghost" style="margin-top:10px;width:100%">Close</button>`;
    document.getElementById("pmDone").onclick = ()=> m.remove();

    // Try to auto-open mail client (popup-blocked in some browsers; user can click button instead)
    try { window.open(mailUrl, "_blank"); } catch(_){}

    // Start countdown + poll for status flip
    let total = 600; // 10 minutes
    const timerEl = document.getElementById("pmTimer");
    const iv = setInterval(()=>{
      total--;
      const m1 = Math.floor(total/60), s1 = String(total%60).padStart(2,"0");
      timerEl.textContent = `${String(m1).padStart(2,"0")}:${s1}`;
      // Check status
      const latest = (DB.payments||[]).find(p=>p.id===rec.id);
      if(latest && latest.status==="paid"){
        clearInterval(iv);
        timerEl.textContent = "✓ CONFIRMED";
        timerEl.style.color = "#15532a";
        after.querySelector("p.sub").innerHTML = `Status: <strong style="color:#15532a">PAID</strong>`;
        if(onSuccess) onSuccess(latest);
        // Mark invoice paid
        if(invoiceId){
          const inv = DB.invoices; const i = inv.findIndex(x=>x.id===invoiceId);
          if(i>-1){ inv[i].status="paid"; inv[i].paidAt=Date.now(); DB.invoices=inv; }
        }
        // Auto-close after 4s
        setTimeout(()=> m.remove(), 4000);
      }
      if(total<=0){
        clearInterval(iv);
        timerEl.textContent = "⌛ TIMED OUT";
        timerEl.style.color = "#b08000";
        const note = document.createElement("p");
        note.style.cssText = "margin-top:10px;background:#fff3cd;border:1px solid #f0d878;border-radius:8px;padding:10px;text-align:center";
        note.innerHTML = "<strong>Admin is checking. Please wait.</strong><br/>You will be emailed once your payment is confirmed.";
        after.appendChild(note);
      }
    }, 1000);
  });
}

// ========================================================
// CSV / Excel export & import (unchanged from v6)
// ========================================================
function toCSV(rows){
  if(!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = v => { v = v==null?"":String(v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  return [cols.join(","), ...rows.map(r=>cols.map(c=>esc(r[c])).join(","))].join("\n");
}
function downloadFile(name, content, type="text/csv"){
  const blob = new Blob([content], {type}); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=name; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function exportUsersCSV(){
  const rows = DB.users.map(u=>({id:u.id,name:u.name,email:u.email,role:u.role,matric:u.matric||"",course:u.course||"",level:u.level||"",gender:u.gender||"",status:u.status||"active",createdAt:new Date(u.createdAt).toISOString()}));
  downloadFile("ocpotech-students-"+Date.now()+".csv", toCSV(rows));
}
function exportPaymentsCSV(){
  const users = DB.users;
  const rows = DB.payments.map(p=>{const u=users.find(x=>x.id===p.userId)||{};return {date:new Date(p.date).toISOString(),name:u.name||p.customer?.name||"",email:u.email||p.customer?.email||"",label:p.label,amount:p.amount,reference:p.reference||p.tx_ref,payerName:p.payerName||"",status:p.status,method:p.method||""};});
  downloadFile("ocpotech-payments-"+Date.now()+".csv", toCSV(rows));
}
function exportApplicationsCSV(){
  const rows = DB.screenings.map(a=>({submitted:new Date(a.submittedAt).toISOString(),name:a.name,gender:a.gender||"",jamb:a.jamb||"",jambScore:a.jambScore||"",phone:a.phone,email:a.email,course:a.course,state:a.state,status:a.status,matric:a.matric||""}));
  downloadFile("ocpotech-screenings-"+Date.now()+".csv", toCSV(rows));
}
function parseCSV(text){
  const lines = text.replace(/\r/g,"").split("\n").filter(Boolean);
  if(!lines.length) return [];
  const split = l => { const out=[]; let cur="", q=false;
    for(let i=0;i<l.length;i++){const c=l[i];
      if(q){ if(c==='"' && l[i+1]==='"'){cur+='"';i++;} else if(c==='"'){q=false;} else cur+=c; }
      else { if(c===','){out.push(cur);cur="";} else if(c==='"'){q=true;} else cur+=c; }
    } out.push(cur); return out;
  };
  const headers = split(lines[0]).map(h=>h.trim());
  return lines.slice(1).map(l=>{const v=split(l);const o={};headers.forEach((h,i)=>o[h]=(v[i]||"").trim());return o;});
}
function _normKey(k){
  k = (k||"").toLowerCase().trim();
  if(/matric/.test(k)) return "matric";
  if(/full\s*name|^name$/.test(k)) return "name";
  if(/dept|depart/.test(k)) return "department";
  if(/level/.test(k)) return "level";
  if(/phone|mobile/.test(k)) return "phone";
  if(/e-?mail/.test(k)) return "email";
  if(/first|given/.test(k)) return "firstname";
  if(/surname|last/.test(k)) return "surname";

  if(/course|program/.test(k)) return "course";
  return k;
}
function _normaliseRow(r){ const o={}; Object.keys(r).forEach(k=> o[_normKey(k)] = r[k]); return o; }

async function bulkImportOldStudents(file){
  let rows = [];
  const name = (file.name||"").toLowerCase();
  if(name.endsWith(".xlsx") || name.endsWith(".xls")){
    if(typeof XLSX === "undefined") throw new Error("Excel reader not loaded. Use CSV or refresh the page.");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, {type:"array"});
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(ws, {defval:""});
  } else { rows = parseCSV(await file.text()); }
  let added=0, skipped=0, errors=[];
  const users = DB.users;
  for(const raw of rows){
    const r = _normaliseRow(raw);
    if(!r.matric || !r.name){ skipped++; continue; }
    const matricU = r.matric.toUpperCase();
    if(users.find(u=>(u.matric||"").toUpperCase()===matricU)){ skipped++; continue; }
    const parts = r.name.trim().split(/\s+/);
    const firstName = (r.firstname || parts[0] || "student").toLowerCase().replace(/[^a-z0-9]/g,"");
    const pwd = firstName || "student";
    const email = r.email || `${matricU.replace(/[^a-z0-9]/gi,"").toLowerCase()}@ocpotech.edu.ng`;
    try{
      users.push({
        id:"u_"+Date.now()+"_"+added, name: r.name, email,
        password: await hashPassword(pwd),
        role: "returning", matric: r.matric,
        course: r.course || r.department || "",
        level: r.level || "ND II",
        createdAt: Date.now(), status: "active",
        mustChangePwd: true, registered: true,
        profile: { phone: r.phone||"", department: r.department||"", tempPassword: pwd }
      });

      added++;
    }catch(e){ errors.push(r.matric); }
  }
  DB.users = users;
  return {added, skipped, errors};
}
async function bulkImportStudents(file){ return bulkImportOldStudents(file); }

// ========================================================
// PRINT HELPERS — header + universal layout
// All large images are resolved via Assets.get()
// ========================================================
function _resolveImg(maybeKey){
  if(!maybeKey) return null;
  if(typeof maybeKey === "string" && maybeKey.startsWith("data:")) return maybeKey;
  return Assets.get(maybeKey);
}
function _printHeaderHTML(subtitle, passportRef){
  const s = DB.settings;
  const passport = _resolveImg(passportRef);
  const passportImg = passport
    ? `<img src="${passport}" alt="Passport" style="width:80px;height:90px;object-fit:cover;border:1px solid #999;margin-left:auto"/>`
    : "";
  return `<div class="print-header" style="display:flex;align-items:center;gap:16px">
    <img src="assets/logo.png" alt="OCPOTECH" style="width:70px;height:70px;border-radius:50%"/>
    <div style="flex:1">
      <h1>${s.schoolName || SCHOOL.name} <span style="font-size:12px;color:#888">(OCPOTECH)</span></h1>
      <div class="addr">${s.address || SCHOOL.address} · RC: ${s.rc || SCHOOL.rc} · Session ${s.session || SCHOOL.session}</div>
      <div class="addr">Tel: ${s.phone || SCHOOL.phone} · ${s.email || SCHOOL.email}</div>
      ${subtitle?`<div class="ptitle">${subtitle}</div>`:""}
    </div>
    ${passportImg}
  </div>`;
}
function _openPrint(title, bodyHTML){
  const w = window.open("", "_blank", "width=900,height=1100");
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title}</title>
    <link rel="stylesheet" href="styles.css"/>
    <style>
      body{background:#fff;padding:24px;font-family:Inter,system-ui,sans-serif;color:#0e1a13}
      .print-header{border-bottom:3px double #0a2e15;padding-bottom:14px;margin-bottom:20px}
      .print-header h1{margin:0;font-size:22px;color:#0a2e15;letter-spacing:.5px}
      .print-header .addr{font-size:12px;color:#5b6b62}
      .print-header .ptitle{margin-top:6px;font-weight:700;text-transform:uppercase;color:#15532a;letter-spacing:1.5px;font-size:13px}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin:8px 0}
      .row{display:flex;justify-content:space-between;border-bottom:1px dotted #cfd8d3;padding:5px 0;font-size:14px}
      .row .k{font-weight:600;color:#22332a;text-transform:uppercase;font-size:11px;letter-spacing:1px}
      .sign{margin-top:60px;display:flex;justify-content:space-between;font-size:13px}
      .sign div{border-top:1px solid #333;padding-top:6px;width:200px;text-align:center}
      h2{color:#15532a;border-bottom:1px solid #cfd8d3;padding-bottom:4px;margin:18px 0 10px;font-size:15px;text-transform:uppercase;letter-spacing:1px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      td,th{padding:6px 8px;border:1px solid #cfd8d3;text-align:left}
      .stamp{position:fixed;bottom:20px;right:24px;font-size:10px;color:#888}
      @media print{.noprint{display:none}}
    </style></head><body>
    ${bodyHTML}
    <div class="stamp">Generated ${new Date().toLocaleString()} · ${SCHOOL.shortName}</div>
    <div class="noprint" style="margin-top:24px;text-align:center">
      <button onclick="window.print()" style="padding:10px 20px;background:#15532a;color:#fff;border:0;border-radius:8px;cursor:pointer;font-weight:600">🖨 Print</button>
    </div>
    </body></html>`);
  w.document.close();
}

// Programme label helper (ND / HND)
function _progLabel(level){
  return /hnd/i.test(level||"") ? "HIGHER NATIONAL DIPLOMA (HND)" : "NATIONAL DIPLOMA (ND)";
}
function _progShort(level){ return /hnd/i.test(level||"") ? "HND" : "ND"; }

// ========== CONFIRMATION / APPLICATION SLIP ==========
function printConfirmationSlip(scr){
  const s = DB.settings;
  const session = s.session || SCHOOL.session;
  const isJambite = !!scr.jamb;
  const prog = _progShort(scr.level);
  const olevel = scr.olevel || [];
  const olRows = Array.from({length:5}).map((_,i)=>{
    const r = olevel[i]||{};
    const g1 = r.grade1 || (r.grade && (!r.grade2) ? r.grade : "") || "";
    const g2 = r.grade2 || "";
    return `<tr><td style="text-align:center">${i+1}</td><td>${r.subject||"N/A"}</td><td style="text-align:center">${g1||"N/A"}</td><td style="text-align:center">${g2||"N/A"}</td></tr>`;
  }).join("");
  const examNo  = scr.olevelExamNo  || scr.examNo  || "—";
  const examTyp = scr.olevelType    || scr.examType|| "WAEC";
  const examYr  = scr.olevelYear    || scr.examYear|| "—";
  const examSit = scr.olevelSitting || scr.sitting || "1st Sitting";
  const agg = computeAggregate(scr);

  const body = _printHeaderHTML(`${session} ${_progLabel(scr.level)} APPLICATION / CONFIRMATION SLIP`, scr.passport) + `
    <h2>BIODATA [${prog}]</h2>
    <div class="grid2">
      <div class="row"><span class="k">Name</span><span>${scr.name}</span></div>
      <div class="row"><span class="k">Application No</span><span>${scr.id}</span></div>
      <div class="row"><span class="k">Gender</span><span>${(scr.gender||"—").toUpperCase()}</span></div>
      <div class="row"><span class="k">Programme</span><span>${prog}</span></div>
      ${isJambite ? `<div class="row"><span class="k">JAMB Reg. No.</span><span>${scr.jamb}</span></div>
                     <div class="row"><span class="k">JAMB Score</span><span>${scr.jambScore||"—"}</span></div>` : `<div class="row"><span class="k">Candidate Type</span><span>NON-JAMBITE</span></div>`}
      <div class="row"><span class="k">State Of Origin</span><span>${(scr.state||"—").toUpperCase()}</span></div>
      <div class="row"><span class="k">Local Govt. Area</span><span>${(scr.lga||"—").toUpperCase()}</span></div>
      <div class="row"><span class="k">Mobile No</span><span>${scr.phone||"—"}</span></div>
      <div class="row"><span class="k">Student E-Mail</span><span>${(scr.email||"—").toUpperCase()}</span></div>
      <div class="row"><span class="k">Faculty</span><span>${scr.faculty||"—"}</span></div>
      <div class="row"><span class="k">Department</span><span>${scr.course||"—"}</span></div>
      <div class="row"><span class="k">Qualification Attained</span><span>${scr.qualification||"SSCE"}</span></div>
      <div class="row"><span class="k">First Choice</span><span>${scr.course||"—"}</span></div>
      <div class="row"><span class="k">Second Choice</span><span>${scr.secondChoice||"—"}</span></div>
    </div>
    <h2>O'LEVEL DETAILS</h2>
    <table>
      <tr><th colspan="4" style="background:#f4f7f4">EXAM NO: ${examNo} &nbsp; · &nbsp; EXAM TYPE: ${examTyp} &nbsp; · &nbsp; YEAR: ${examYr} &nbsp; · &nbsp; SITTING: ${examSit}</th></tr>
      <tr><th style="width:40px">S/N</th><th>SUBJECT</th><th style="width:120px">GRADE (1ST SITTING)</th><th style="width:120px">GRADE (2ND SITTING)</th></tr>
      ${olRows}
    </table>
    <h2>SCREENING GRADE</h2>
    <div class="grid2">
      <div class="row"><span class="k">Aggregate Score (max 100)</span><span><strong>${Math.round(agg.aggregate)}</strong></span></div>
      <div class="row"><span class="k">Type Of Admission</span><span>${(scr.admissionType||"FULL TIME").toUpperCase()}</span></div>
      <div class="row"><span class="k">Status</span><span>${scr.status}</span></div>
    </div>
    <div class="sign"><div>Candidate Signature</div><div>Admissions Officer</div></div>`;

  _openPrint("Confirmation Slip — "+scr.name, body);
}
function printScreeningSlip(scr){ return printConfirmationSlip(scr); }

// ========== ADMISSION NOTIFICATION ==========
function printAdmissionNotification(scr){
  const s = DB.settings; const session = s.session || SCHOOL.session;
  const isJambite = !!scr.jamb;
  const deadline = new Date(Date.now()+72*3600*1000).toDateString();
  const bank = (s.bank) || DEFAULT_BANK;
  const acc = acceptanceBreakdown(scr.faculty || facultyOfProgramme(scr.course));
  const accLines = acc.instrument
    ? `<h2>1. ACCEPTANCE FEE</h2>
       <p style="font-size:13px;line-height:1.7">
         Acceptance Fee: <strong>₦${acc.acceptance.toLocaleString()}:00K</strong><br/>
         ${acc.label}: <strong>₦${acc.instrument.toLocaleString()}:00K</strong><br/>
         <strong>TOTAL: ₦${acc.total.toLocaleString()}:00K</strong>
       </p>`
    : `<h2>1. ACCEPTANCE FEE: ₦${acc.total.toLocaleString()}:00K</h2>`;
  const body = _printHeaderHTML(`${session} ADMISSION MESSAGE`, scr.passport) + `
    <div class="grid2">
      <div class="row"><span class="k">Name</span><span>${(scr.name||"").toUpperCase()}</span></div>
      <div class="row"><span class="k">Gender</span><span>${(scr.gender||"—").toUpperCase()}</span></div>
      <div class="row"><span class="k">Candidate Status</span><span>${isJambite?"JAMBITE":"NON - JAMBITE"}</span></div>
      <div class="row"><span class="k">Application I.D</span><span>${scr.id}</span></div>
      ${isJambite ? `<div class="row"><span class="k">JAMB Reg</span><span>${scr.jamb}</span></div>
                     <div class="row"><span class="k">JAMB Score</span><span>${scr.jambScore||"—"}</span></div>` : ""}
      <div class="row"><span class="k">Programme</span><span>${_progLabel(scr.level)}</span></div>
      <div class="row"><span class="k">Proposed Department</span><span>${(scr.course||"—").toUpperCase()}</span></div>
      <div class="row"><span class="k">Faculty</span><span>${(scr.faculty||"—").toUpperCase()}</span></div>
    </div>
    <p style="font-size:14px;line-height:1.6;margin-top:14px">
      Congratulations, you have been considered for admission into <strong>ONDO CITY POLYTECHNIC (OCPOTECH), ${session}</strong> Academic Session.
    </p>
    <p style="font-size:14px;line-height:1.6">You are therefore eligible to make the following payment within 3 days (72 hours).</p>
    <p style="background:#fff3a8;padding:8px;font-weight:700">DEADLINE: ${deadline}</p>
    ${accLines}
    <p style="background:#fff3a8;padding:8px;font-size:13px;line-height:1.7">
      <strong>PAYMENT TO ${bank.bankName}</strong><br/>
      <strong>ACCOUNT NAME:</strong> ${bank.accountName}<br/>
      <strong>ACCOUNT NUMBER:</strong> ${bank.accountNumber}
    </p>
    <p style="font-size:13px;line-height:1.6">
      After payment, <strong>login to your portal</strong> at <u>www.ondocitypoly.com.ng</u> to upload your proof of payment and continue your registration.<br/>
      <strong>Username:</strong> your <em>first name</em> in lowercase (e.g. <code>${(scr.name||"").split(" ")[0].toLowerCase()}</code>)<br/>
      <strong>Password:</strong> your Registration / Application Number (<code>${scr.jamb||scr.id}</code>)
    </p>
    <p style="font-size:13px">Once again Congratulations — <u>www.ondocitypoly.com.ng</u></p>`;
  _openPrint("Admission Notification — "+scr.name, body);
}

// ========== ACCEPTANCE LETTER (per Otura PDF) ==========
function printAcceptanceLetter(user){
  const s = DB.settings; const bio = DB.biodata[user.id]||{};
  const session = s.session || SCHOOL.session;
  const ref = `OCPOTECH/AD/${session.split("/")[0].slice(-2)}/${(user.matric||user.id||"100").toString().split("/").pop()}`;
  const acc = acceptanceBreakdown(bio.faculty || user.faculty || facultyOfProgramme(user.course));
  const _NW = {30000:"Thirty Thousand",50000:"Fifty Thousand",60000:"Sixty Thousand",80000:"Eighty Thousand",100000:"One Hundred Thousand"};
  const amtWords = _NW[acc.total] || (acc.total.toLocaleString()+" Naira");
  const accBreakdown = acc.instrument
    ? ` (Acceptance Fee ₦${acc.acceptance.toLocaleString()} + ${acc.label} ₦${acc.instrument.toLocaleString()})`
    : "";
  const body = _printHeaderHTML("LETTER OF ACCEPTANCE", bio.passport||user.profile?.passport) + `
    <p style="font-size:12px;color:#666">Campus 2, Adegoke Lane, Arigbabola, Ondo City, Ondo State · RC: 1472598</p>
    <p style="margin-top:14px"><strong>NAME:</strong> ${(user.name||"").toUpperCase()}</p>
    <p><strong>ADDRESS:</strong> ${(bio.address||"—").toUpperCase()}</p>
    <p><strong>DATE:</strong> ${new Date().toDateString().toUpperCase()}</p>
    <p style="margin-top:10px"><strong>Our Ref:</strong> ${ref}</p>
    <p style="margin-top:14px">The Registrar,<br/>Ondo City Polytechnic (OCPOTECH),<br/>Ondo City, Ondo State.</p>
    <p>Dear Sir/Ma,</p>
    <p style="font-weight:700">RE: OFFER OF PROVISIONAL ADMISSION FOR ${_progLabel(user.level)} PROGRAMME FOR ${session} ACADEMIC SESSION</p>
    <p style="font-weight:700;text-decoration:underline">LETTER OF ACCEPTANCE</p>
    <p style="font-size:14px;line-height:1.7">
      I wish to refer to your letter <strong>${ref}</strong> on the subject above to inform you that I accept the offer of provisional admission into Ondo City Polytechnic, Ondo to study <strong>${(user.course||"—").toUpperCase()}</strong>.
    </p>
    <p style="font-size:14px;line-height:1.7">
      I attach herewith a copy of the official receipt obtained from the bursar Ondo City Polytechnic for the sum of <u>${amtWords} Naira (₦${acc.total.toLocaleString()}:00K) only</u>${accBreakdown} as Acceptance fees.
    </p>
    <p style="margin-top:30px">Yours faithfully,</p>
    <p style="margin-top:30px">_____________________<br/>Student's Signature</p>`;
  _openPrint("Acceptance Letter — "+user.name, body);
}

// ========== REAL ADMISSION LETTER (per Olaniyi PDF) ==========
function printRealAdmissionLetter(user){
  const s = DB.settings;
  const bio = DB.biodata[user.id] || {};
  const session = s.session || SCHOOL.session;
  const passport = bio.passport || user.profile?.passport;
  const isHND = /hnd/i.test(user.level||"");
  const ref = `OCPOTECH/REG/004/${stableHash4(user.matric||user.id||user.email||user.name||"")}`;
  const body = _printHeaderHTML("OFFICE OF THE REGISTRAR", passport) + `
    <p style="font-size:12px;color:#666">Adegoke Street, Arigbabola, Ondo City, Ondo State · RC: 1472598 · www.ondocitypoly.com.ng · ${s.email||SCHOOL.email}</p>
    <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:13px">
      <div><strong>Our Ref:</strong> ${ref}</div>
      <div><strong>Date:</strong> ${new Date().toDateString().toUpperCase()}</div>
    </div>
    <p style="margin-top:20px;font-size:16px;font-weight:700">${(user.name||"").toUpperCase()}</p>
    <p><strong>ADDRESS:</strong> ${(bio.address||"—").toUpperCase()}</p>
    <p style="margin-top:14px;font-weight:700;font-size:15px">${session} OFFER OF PROVISIONAL ADMISSION FOR ${isHND?"HIGHER NATIONAL DIPLOMA":"NATIONAL DIPLOMA"}</p>
    <p style="font-size:14px;line-height:1.7">
      I am pleased to inform you that you have been offered provisional admission to <strong>ONDO CITY POLYTECHNIC, ONDO (OCPOTECH)</strong>, to pursue a <strong>${isHND?"HIGHER NATIONAL DIPLOMA":"NATIONAL DIPLOMA"}</strong> programme in <strong>${(user.course||"—").toUpperCase()}</strong>.
    </p>
    <div class="grid2" style="margin-top:14px">
      <div class="row"><span class="k">Faculty</span><span>${(user.faculty||bio.faculty||"—").toUpperCase()}</span></div>
      <div class="row"><span class="k">Department</span><span>${(user.course||"—").toUpperCase()}</span></div>
      <div class="row"><span class="k">Programme</span><span>${isHND?"HND":"ND"}</span></div>
      <div class="row"><span class="k">Duration of Course</span><span>2 YEARS</span></div>
    </div>
    <p style="font-size:13px;line-height:1.7;margin-top:14px">
      The confirmation of this offer is subject to your obtaining the minimum entry qualifications for the course to which you have been offered admission, as well as fulfilling the conditions spelt out below.
    </p>
    <ol style="font-size:13px;line-height:1.7">
      <li>At the time of registration in Ondo City Polytechnic, you will be required to present originals of the certificate(s) or any other acceptable evidence of the qualifications on which this offer of admission has been based. The School Management reserves the right to withdraw your admission if it is discovered that you have been involved in any form of admission irregularities even after registration by the institution.</li>
      <li>If it is discovered at any time that you do not possess any of the qualifications which you claim to have obtained, you will be required to withdraw from the institution.</li>
      <li>In the absence of any response from you within reasonable time, the institution will assume that you are not interested in the offer and may proceed to fill your space.</li>
      <li>Information relating to date of registration, schedule of fees and medical examination should be obtained from the Registrar of the institution.</li>
      <li>You are required to be in the institution at the time of registration with a letter of reference from a person of reputable standing in the society vouching for your good behaviour.</li>
      <li>You are to complete the enclosed <strong>Acceptance Form</strong> and return it immediately to the Registrar Office together with a non-refundable Acceptance fee in Bank draft/receipt made payable to <strong>Bursar, Ondo City Polytechnic (OCPOTECH)</strong>.</li>
      <li>You are to note that you will not be registered unless, and until you have fulfilled all the academic and financial conditions for registration. If it is discovered in the course of your studentship on the Polytechnic's campus that the documents with which you obtained this admission into the Polytechnic are fake, the admission itself will be nullified.</li>
      <li>Accept my congratulations on your admission.</li>
    </ol>
    <div class="sign" style="margin-top:50px"><div></div><div><strong>MR. OLANREWAJU S. ILEMOBAYO</strong><br/>Registrar</div></div>`;
  _openPrint("Admission Letter — "+user.name, body);
}
// Old name kept as alias to the REAL admission letter now
function printAdmissionLetter(user){ return printRealAdmissionLetter(user); }
function downloadAdmissionLetter(user){ return printRealAdmissionLetter(user); }

// ========== GUARANTOR FORM ==========
function printGuarantorForm(user){
  const bio = DB.biodata[user.id]||{};
  const g = bio.guarantor || {};
  const body = _printHeaderHTML("GUARANTOR'S FORM", bio.passport) + `
    <p style="font-size:12px;color:#666">Campus 2, Adegoke Lane, Arigbabola, Ondo City, Ondo State · RC: 1472598</p>
    <p style="margin-top:14px"><strong>NAME:</strong> ${(g.name||"_______________________").toUpperCase()}</p>
    <p><strong>ADDRESS:</strong> ${(g.address||"_______________________").toUpperCase()}</p>
    <p><strong>OCCUPATION:</strong> ${(g.occupation||"_______________________").toUpperCase()}</p>
    <p><strong>PHONE:</strong> ${g.phone||"_______________________"}</p>
    <p><strong>DATE:</strong> ${new Date().toDateString()}</p>
    <p>Dear Sir/Ma,</p>
    <p style="font-weight:700">ADMISSION TO ONDO CITY POLYTECHNIC (OCPOTECH), ONDO.</p>
    <p style="font-weight:700;text-decoration:underline">GUARANTOR'S FORM</p>
    <p style="font-size:14px;line-height:1.8">
      I <strong>${(g.name||"________________").toUpperCase()}</strong> (Name of Guarantor) write to confirm that
      <strong>${(user.name||"").toUpperCase()}</strong> who is my <strong>${g.relationship||"________________"}</strong>
      is well known to me and I hereby testify to his/her good conduct.
    </p>
    <p style="font-size:14px;line-height:1.8">
      In addition, I wish to affirm here my readiness to accept responsibility for his/her behaviour throughout the period of his/her stay in Ondo City Polytechnic Campus.
    </p>
    <p style="font-size:14px;line-height:1.8">
      I also pledge that he/she will not participate in any cultist activities, examination malpractices and other social vices throughout his/her stay on the campus.
    </p>
    <p style="margin-top:30px">Yours faithfully,</p>
    <p style="margin-top:30px">_____________________<br/>Signature / Stamp / Date</p>`;
  _openPrint("Guarantor Form — "+user.name, body);
}

// ========== PAYMENT LIST / CLEARANCE FORM ==========
// TUITION FEE changes per programme; admin can edit in Programme Fees tab.
// Shared builder so the dashboard "School Fees" card, its breakdown popup and
// the printed Payment List all use the SAME line items and total.
function paymentListFor(user){
  const s = DB.settings; const bio = DB.biodata[user.id]||{};
  const session = s.session || SCHOOL.session;
  const bank = s.bank || DEFAULT_BANK;
  const course = user.course || bio.course || "";
  const stateStr = bio.state || user.state || user.profile?.state || "";
  const faculty = facultyOfUser(user) || facultyOfProgramme(course);
  const mode = (bio.mode || user.mode || user.profile?.mode || "").toString();
  const level = (bio.level || user.level || user.profile?.level || "").toString();
  const isPartTime = /part/i.test(mode);
  const isIndigene = /ondo/i.test(stateStr);
  const tuition = computeTuition({faculty, course, state: stateStr, mode, level});
  const devLevy = isIndigene ? 2500 : 3000;
  // Per user directive: PT exam fee is ₦12,000; FT exam fee is ₦25,000.
  const examFee = isPartTime ? 12000 : 25000;
  let tuitionLabel;
  if(isPartTime){
    tuitionLabel = "TUITION FEE (PART-TIME "+(/hnd/i.test(level)?"HND":"ND")+")";
  } else {
    tuitionLabel = "TUITION FEE ("+(isIndigene?"INDIGENE":"NON-INDIGENE")+")";
  }

  // Detect whether the student has ALREADY completed the first school-fee
  // payment. After the first payment, subsequent semesters show a reduced
  // "per-semester" list only:
  //   - PART-TIME: TUITION + EXAM FEE
  //   - FULL-TIME: EXAM FEE only
  const firstPaid = (typeof hasPaid === "function") && hasPaid(user.id, "school_fee");
  // Returning students never see the full fresh-student payment list — they only
  // pay per-semester fees (Tuition+Exam for PT, Exam only for FT).
  const isReturning = (user.role === "returning") || firstPaid;
  let fees, isPerSemester = false;
  if(isReturning){
    isPerSemester = true;
    fees = isPartTime
      ? [ [tuitionLabel, tuition], ["EXAM FEE", examFee] ]
      : [ ["EXAM FEE", examFee] ];
  } else {
    fees = [
      ["FILING",                4000],
      ["SCREENING FORM",        3000],
      ["LIBRARY FEE",           2500],
      ["DEPARTMENTAL FEE",      2500],
      ["FACULTY FEE",           2500],
      ["DEVELOPMENT LEVY",      devLevy],
      ["I.C.T",                 10000],
      ["I.D CARD",              3500],
      ["RESULTS VERIFICATION",  5000],
      ["MAINTENANCE FEE",       3500],
      ["EXAM FEE",              examFee],
      ["MEDICAL FEE",           5000],
      ["LAB FEE",               5000],
      ["PORTAL MAINTENANCE",    4000],
      ["VOCATIONAL TRAINING",   10000],
      [tuitionLabel, tuition],
    ];
  }
  // Late payment charge lives OUTSIDE the school-fee list. It is offered as
  // a separate payment the student can settle before/alongside school fees.
  // Rule: ₦10,000 if it has been more than 10 days (1 week + 3 days) since
  // the acceptance fee was paid AND school fees are still outstanding.
  // Once the school fee is paid, the charge disappears from the list — but any
  // late-charge payment already made stays in Payment History.
  let lateCharge = 0;
  let acceptancePaidAt = 0;
  let lateDeadline = 0;
  let daysLeft = 0;
  try{
    if(!firstPaid){
      const accPay = (DB.payments||[]).find(p=>p.userId===user.id && p.feeKey==="acceptance" && p.status==="paid");
      if(accPay){
        const anchor = accPay.confirmedAt || accPay.paidAt || accPay.date || accPay.at || 0;
        if(anchor){
          acceptancePaidAt = anchor;
          lateDeadline = anchor + 10*86400000;
          const days = (Date.now() - anchor) / 86400000;
          daysLeft = Math.max(0, Math.ceil(10 - days));
          if(days > 10) lateCharge = 10000;
        }
      }
    }
  }catch(_){}
  const total = fees.reduce((a,r)=>a+r[1],0);
  return { fees, total, session, bank, course, tuition, isIndigene, bio, isPerSemester, lateCharge, acceptancePaidAt, lateDeadline, daysLeft };
}

// Total of the payment list = the amount shown for "School Fees".
function schoolFeeTotal(user){
  try { return paymentListFor(user).total; } catch(e){ return 0; }
}

// Notice banner shown on student dashboards so they know about the 10-day
// grace period before the ₦10,000 late payment charge locks school fees.
function lateFeeNoticeHTML(user){
  try{
    user = user || (typeof Auth!=="undefined" && Auth.current()) || {};
    const info = paymentListFor(user);
    if(!info || !info.acceptancePaidAt) return "";
    const payLabel = info.isPerSemester ? "Semester Fees" : "School Fees";
    // If already paid school fees, no notice needed.
    const s = DB.settings || {}; const bio = DB.biodata[user.id] || {};
    const semKey = info.isPerSemester
      ? ("semester_fee_"+(s.session||"").replace(/\W+/g,"_")+"_"+((bio.semester||"HARMATTAN").toLowerCase()))
      : "school_fee";
    if(typeof hasPaid==="function" && hasPaid(user.id, semKey)) return "";
    if(info.lateCharge > 0){
      const latePaid = typeof hasPaid==="function" && hasPaid(user.id, "late_payment_charge");
      return `<section class="panel" style="border:1px solid #f5c26b;background:#fff8e6">
        <h3 style="margin:0 0 6px;color:#8a5a00">⚠ Late Payment Charge Applied</h3>
        <p class="sub" style="color:#8a5a00;margin:0">
          Your 10-day window to pay ${payLabel.toLowerCase()} has expired. A
          <strong>₦10,000 late payment charge</strong> has been added and your
          ${payLabel.toLowerCase()} button is <strong>locked</strong> until this charge is cleared.
          ${latePaid?'<br/><strong>Late charge paid ✓ — you can now pay your '+payLabel.toLowerCase()+'.</strong>':''}
        </p>
      </section>`;
    }
    return `<section class="panel" style="border:1px solid #bcdcc3;background:#eefbf1">
      <h3 style="margin:0 0 6px;color:#15532a">📢 ${payLabel} Payment Notice</h3>
      <p class="sub" style="color:#15532a;margin:0">
        You have <strong>${info.daysLeft} day${info.daysLeft===1?'':'s'}</strong> left to pay your ${payLabel.toLowerCase()}
        (deadline: <strong>${new Date(info.lateDeadline).toLocaleDateString()}</strong>).
        If not paid by then, a <strong>₦10,000 late payment charge</strong> will be added and your
        ${payLabel.toLowerCase()} button will be <strong>locked</strong> until the charge is cleared.
      </p>
    </section>`;
  }catch(_){ return ""; }
}


// Popup that shows the payment list breakdown (what the student is paying for)
// with a Pay button. Used when the student clicks the School Fees card.
function openSchoolFeePopup(user){
  user = user || (typeof Auth!=="undefined" && Auth.current()) || {};
  const { fees, total, bank, isPerSemester, lateCharge, lateDeadline, daysLeft } = paymentListFor(user);
  const lateFeeKey = "late_payment_charge";
  const latePaid = lateCharge>0 && (typeof hasPaid==="function") && hasPaid(user.id, lateFeeKey);
  const latePending = lateCharge>0 && (typeof hasPending==="function") && hasPending(user.id, lateFeeKey);
  // For the FIRST payment, we look at school_fee.
  // For subsequent semesters (isPerSemester === true), each semester's fees
  // must be payable again — so we key them by session+semester and only mark
  // paid if the CURRENT semester bill has been settled.
  const s = DB.settings; const bio = DB.biodata[user.id]||{};
  const semKey = isPerSemester
    ? ("semester_fee_"+(s.session||"").replace(/\W+/g,"_")+"_"+((bio.semester||"HARMATTAN").toLowerCase()))
    : "school_fee";
  const alreadyPaid = (typeof hasPaid==="function") && hasPaid(user.id, semKey);
  const title = isPerSemester ? "Semester Fees — Payment List" : "School Fees — Payment List";
  const payLabel = isPerSemester ? "Semester Fees" : "School Fees";
  const old = document.getElementById("schoolFeeModal"); if(old) old.remove();
  const m = document.createElement("div");
  m.id = "schoolFeeModal";
  m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;z-index:9999;padding:24px;overflow:auto";
  m.innerHTML = `
    <div style="background:#fff;border-radius:16px;max-width:560px;width:100%;padding:24px;box-shadow:0 24px 60px rgba(0,0,0,.4);font-family:inherit">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
        <div>
          <h2 style="margin:0;color:#15532a">${title}</h2>
          <p class="sub" style="color:#666;margin:4px 0 0">What you are paying for</p>
        </div>
        <button id="sfClose" class="btn btn-ghost" style="padding:4px 10px">✕</button>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:14px;font-size:14px">
        <tr style="text-align:left;border-bottom:2px solid #15532a"><th style="padding:6px 4px">S/N</th><th style="padding:6px 4px">DESCRIPTION</th><th style="padding:6px 4px;text-align:right">AMOUNT</th></tr>
        ${fees.map((f,i)=>`<tr style="border-bottom:1px solid #eee"><td style="padding:6px 4px">${i+1}.</td><td style="padding:6px 4px">${f[0]}</td><td style="padding:6px 4px;text-align:right">₦${f[1].toLocaleString()}</td></tr>`).join("")}
        <tr style="border-top:2px solid #15532a"><td colspan="2" style="padding:8px 4px;text-align:right;font-weight:700">TOTAL</td><td style="padding:8px 4px;text-align:right;font-weight:700">₦${total.toLocaleString()}</td></tr>
      </table>
      <div style="margin-top:16px;display:flex;gap:10px;flex-direction:column">
        ${alreadyPaid
          ? `<span class="status-pill status-paid">${payLabel} paid ✓</span>`
          : (lateCharge>0 && !latePaid)
            ? `<button class="btn" style="background:#ccc;color:#666;cursor:not-allowed" disabled title="Clear late payment charge first">🔒 Pay ${payLabel} (₦${total.toLocaleString()}) — Locked</button>
               <div class="sub" style="color:#b00;font-size:12px;text-align:center">⚠ Clear late payment charge first before paying ${payLabel.toLowerCase()}.</div>`
            : `<button id="sfPay" class="btn btn-green">Pay ${payLabel} (₦${total.toLocaleString()}) →</button>`}
      </div>
      ${lateCharge>0 ? `
      <div style="margin-top:18px;padding:12px 14px;border:1px solid #f5c26b;background:#fff8e6;border-radius:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <strong style="color:#8a5a00">Late Payment Charge ${latePaid?'':'(Pay First)'}</strong>
            <div class="sub" style="color:#8a5a00;font-size:12px">Applies because school fees are still outstanding more than 10 days after acceptance. Must be cleared before school fees.</div>
          </div>
          <div style="font-weight:700;color:#8a5a00">₦${lateCharge.toLocaleString()}</div>
        </div>
        <div style="margin-top:10px">
          ${latePaid
            ? `<span class="status-pill status-paid">Late charge paid ✓</span>`
            : latePending
              ? `<span class="status-pill status-pending">Late charge awaiting confirmation</span>`
              : `<button id="sfLatePay" class="btn btn-green" style="width:100%">Pay Late Payment Charge (₦${lateCharge.toLocaleString()}) →</button>`}
        </div>
      </div>` : (lateDeadline>0 && !alreadyPaid ? `
      <div style="margin-top:18px;padding:12px 14px;border:1px solid #bcdcc3;background:#eefbf1;border-radius:10px">
        <strong style="color:#15532a">📢 School Fees Payment Notice</strong>
        <div class="sub" style="color:#15532a;font-size:12px;margin-top:4px">
          You have <strong>${daysLeft} day${daysLeft===1?'':'s'}</strong> left to pay your ${payLabel.toLowerCase()} (deadline: <strong>${new Date(lateDeadline).toLocaleDateString()}</strong>).
          If not paid by then, a <strong>₦10,000 late payment charge</strong> will be added and your ${payLabel.toLowerCase()} button will be locked until the charge is cleared.
        </div>
      </div>` : ``)}
    </div>`;
  document.body.appendChild(m);
  document.getElementById("sfClose").onclick = ()=> m.remove();
  const payBtnEl = document.getElementById("sfPay");
  if(payBtnEl){
    payBtnEl.onclick = ()=>{
      m.remove();
      pay({ feeKey:semKey, customAmount:total, customLabel:payLabel,
        onSuccess:()=>{ toast("Payment successful!"); setTimeout(()=>location.reload(),800); } });
    };
  }
  const lateBtnEl = document.getElementById("sfLatePay");
  if(lateBtnEl){
    lateBtnEl.onclick = ()=>{
      m.remove();
      pay({ feeKey:lateFeeKey, customAmount:lateCharge, customLabel:"Late Payment Charge",
        onSuccess:()=>{ toast("Late payment recorded!"); setTimeout(()=>location.reload(),800); } });
    };
  }
}

function printPaymentList(user){
  const { fees, total, session, bank } = paymentListFor(user);
  const bio = DB.biodata[user.id]||{};
  const body = _printHeaderHTML("PERSONAL DATA REGISTRATION CLEARANCE FORM", bio.passport||user.profile?.passport) + `
    <p style="font-size:12px;color:#666">Campus 2, Adegoke Lane, Arigbabola, Ondo City · RC: 1472598</p>
    <h2>PERSONAL DATA</h2>
    <div class="grid2">
      <div class="row"><span class="k">Name</span><span>${(user.name||"").toUpperCase()}</span></div>
      <div class="row"><span class="k">Gender</span><span>${(user.gender||user.profile?.gender||"—").toUpperCase()}</span></div>
      <div class="row"><span class="k">Level</span><span>${user.level||bio.level||"—"}</span></div>
      <div class="row"><span class="k">Type Of Programme</span><span>${(bio.category||(user.profile?.mode||"FULL TIME")).toUpperCase()}</span></div>
      <div class="row"><span class="k">Programme</span><span>${_progLabel(user.level)}</span></div>
      <div class="row"><span class="k">Faculty</span><span>${(bio.faculty||user.faculty||"—").toUpperCase()}</span></div>
      <div class="row"><span class="k">Department</span><span>${(bio.department||user.course||"—").toUpperCase()}</span></div>
      <div class="row"><span class="k">Semester</span><span>${(bio.semester||"HARMATTAN").toUpperCase()}</span></div>
      <div class="row"><span class="k">Academic Session</span><span>${session}</span></div>
      <div class="row"><span class="k">State Of Origin</span><span>${(bio.state||"—").toUpperCase()}</span></div>
    </div>
    <h2>REGISTRATION FEES — TOTAL ₦${total.toLocaleString()}</h2>
    <table>
      <tr><th>S/N</th><th>DESCRIPTION</th><th style="text-align:right">AMOUNT</th></tr>
      ${fees.map((f,i)=>`<tr><td>${i+1}.</td><td>${f[0]}</td><td style="text-align:right">₦${f[1].toLocaleString()}:00K</td></tr>`).join("")}
      <tr><td colspan="2" style="text-align:right;font-weight:700">TOTAL</td><td style="text-align:right;font-weight:700">₦${total.toLocaleString()}:00K</td></tr>
    </table>
    <p style="font-size:12px;margin-top:10px">DEADLINE: THURSDAY 30TH APRIL, ${session.split("/")[1]}<br/>
    LATE PAYMENT ₦10,000 APPLIES 1 WEEK 3 DAYS AFTER ACCEPTANCE FEE, ${session.split("/")[1]}<br/>
    ALL PAYMENT SHOULD BE MADE TO THE POLYTECHNIC'S BANK ACCOUNT BELOW<br/>
    THIS PAYMENT LIST MUST BE SIGNED AND STAMPED BY THE SCHOOL BURSAR ON THE PHYSICAL SCREENING DAY.<br/>
    ACCOUNT NAME: ${bank.accountName} · ACCOUNT NO: ${bank.accountNumber} · BANK: ${bank.bankName}</p>`;
  _openPrint("Payment List — "+user.name, body);
}

function printBioData(user, bio){
  const passport = _resolveImg(bio?.passport || user?.profile?.passport);
  const row = (k,v)=>`<div class="row"><span class="k">${k}</span><span>${v||"—"}</span></div>`;
  const body = _printHeaderHTML("Student Bio Data Form", passport) + `
    <div class="grid2">
      ${row("Jamb No", bio.jamb || user.profile?.jamb)}
      ${row("JAMB Score", bio.jambScore || user.profile?.jambScore)}
      ${row("Full Name", user.name)}
      ${row("Gender", user.gender || bio.sex)}
      ${row("Department", bio.department)}
      ${row("Course", user.course || bio.course)}
      ${row("Level", user.level || bio.level)}
      ${row("Programme", _progShort(user.level||bio.level))}
      ${row("Semester", bio.semester)}
      ${row("Session", DB.settings.session)}
    </div>
    <h2>Personal</h2>
    <div class="grid2">
      ${row("Country", bio.country)} ${row("State", bio.state)}
      ${row("LGA", bio.lga)} ${row("Address", bio.address)}
      ${row("Phone", bio.phone)} ${row("Email", user.email)}
      ${row("Birth Date", bio.dob)} ${row("Birth Place", bio.birthPlace)}
      ${row("Blood Group", bio.bloodGroup)} ${row("Genotype", bio.genotype)}
      ${row("Health Condition", bio.health)} ${row("Marital Status", bio.marital)}
      ${row("Religion", bio.religion)}
    </div>
    <h2>Guardian / Next of Kin</h2>
    <div class="grid2">
      ${row("Name", bio.nokName)} ${row("Relationship", bio.nokRel)}
      ${row("Phone", bio.nokPhone)} ${row("Email", bio.nokEmail)}
      ${row("Address", bio.nokAddress)}
    </div>
    <div class="sign"><div>Student Signature</div><div>Registrar</div></div>`;
  _openPrint("Bio Data — "+user.name, body);
}

function printInvoice(inv, user){
  const u = user || DB.users.find(x=>x.id===inv.userId) || {name:inv.studentName||"Student",matric:""};
  const passport = _resolveImg((DB.biodata[u.id]||{}).passport || u.profile?.passport);
  const isAcceptance = /acceptance/i.test(inv.label||"");
  const bd = inv.breakdown || (isAcceptance ? acceptanceBreakdown(u.faculty || u.profile?.faculty || facultyOfProgramme(u.course)) : null);
  const shownAmount = isAcceptance && bd ? bd.total : (inv.amount||0);
  const firstName = (u.name||"").split(/\s+/)[0].toLowerCase() || "yourfirstname";
  const regRef = u.profile?.jamb || u.profile?.appNo || u.matric || inv.id;
  const acceptanceBlock = isAcceptance && bd ? `
    <h2>1. Acceptance Fee</h2>
    <div style="background:#fffbe6;border-left:5px solid #f4d03f;padding:14px 16px;border-radius:8px;margin:0 0 12px">
      <div style="font-size:14px;margin:2px 0"><strong>Acceptance Fee:</strong> ₦${bd.acceptance.toLocaleString()}:00K</div>
      ${bd.instrument ? `<div style="font-size:14px;margin:2px 0;color:#0a2e15"><strong>${bd.label}:</strong> ₦${bd.instrument.toLocaleString()}:00K</div>` : ``}
      <div style="font-size:14px;margin:6px 0 0;border-top:1px dashed #d9c66a;padding-top:6px"><strong>TOTAL:</strong> ₦${bd.total.toLocaleString()}:00K</div>
    </div>
    <div style="background:#fffbe6;border:1px dashed #d9c66a;padding:14px 16px;border-radius:8px;text-align:center;font-size:13px;line-height:1.6;margin:0 0 14px">
      login to your portal, pay and upload your proof of payment and continue your registration.<br/>
      <strong>Username:</strong> your first name in lowercase (e.g. ${firstName}), &nbsp;
      <strong>Password:</strong> your Registration / Application Number (${regRef})<br/>
      Once again Congratulations — www.ondocitypoly.com.ng
    </div>` : ``;
  const body = _printHeaderHTML("Payment Invoice / Receipt", passport) + `
    <div class="grid2">
      <div class="row"><span class="k">Invoice No.</span><span>${inv.id}</span></div>
      <div class="row"><span class="k">Date</span><span>${new Date(inv.createdAt||Date.now()).toLocaleString()}</span></div>
      <div class="row"><span class="k">Student</span><span>${u.name}</span></div>
      <div class="row"><span class="k">Reference</span><span>${regRef}</span></div>
      <div class="row"><span class="k">Fee Type</span><span>${inv.label}</span></div>
      <div class="row"><span class="k">Session</span><span>${inv.session||DB.settings.session}</span></div>
      <div class="row"><span class="k">Amount</span><span>₦${shownAmount.toLocaleString()}</span></div>
      <div class="row"><span class="k">Status</span><span>${(inv.status||"—").toUpperCase()}</span></div>
    </div>
    ${acceptanceBlock}
    <h2>Notes</h2>
    <p style="font-size:13px">${inv.note||"This receipt is computer generated; no signature required when status is PAID."}</p>
    <div class="sign"><div>Student</div><div>Bursar</div></div>`;
  _openPrint("Invoice — "+inv.id, body);
}

function printCourseForm(user, regs){
  const bio = DB.biodata[user.id]||{};
  const totalUnits = regs.reduce((s,r)=>s+(Number(r.units)||0),0);
  const passport = _resolveImg(bio.passport || user.profile?.passport);
  const dept    = (bio.department || user.course || "—").toUpperCase();
  const faculty = (bio.faculty || user.faculty || facultyOfProgramme(user.course) || "—").toUpperCase();
  const level   = (bio.level || user.level || "—").toUpperCase();
  const semester= (bio.semester || "HARMATTAN").toUpperCase();
  const session = DB.settings.session;
  const matric  = user.matric || "—";
  const rows = regs.map((r,i)=>`
    <tr>
      <td style="text-align:center">${i+1}.</td>
      <td>${r.code||""}</td>
      <td>${(r.title||"").toUpperCase()}</td>
      <td style="text-align:center">${r.units||""}${(r.status||"C").toString().toUpperCase().startsWith("E")?"E":"C"}</td>
      <td style="text-align:center">${(r.status||"COMPULSORY").toUpperCase()}</td>
      <td></td>
    </tr>`).join("");
  const emptyCarry = Array.from({length:5}).map((_,i)=>`
    <tr><td style="text-align:center">${i+1}.</td><td></td><td></td><td></td><td></td><td></td></tr>`).join("");
  const dotFill = (val, w) => `<span style="display:inline-block;min-width:${w};border-bottom:none;">${val}</span><span style="letter-spacing:2px;color:#333">${".".repeat(30)}</span>`;
  const watermarkCSS = `
    <style>
      .ocp-print-wrap{position:relative;font-family:'Times New Roman',serif;color:#111;}
      .ocp-print-wrap::before{
        content:"";position:fixed;inset:0;z-index:0;pointer-events:none;
        background-image:repeating-linear-gradient(-18deg,
          transparent 0 40px,
          rgba(0,0,0,0) 40px 41px);
      }
      .ocp-watermark{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;opacity:.10;}
      .ocp-watermark div{white-space:nowrap;font-size:11px;color:#c9a227;letter-spacing:2px;line-height:22px;font-weight:700}
      .ocp-content{position:relative;z-index:1}
      .ocp-title{color:#12a34a;font-weight:800;font-size:34px;letter-spacing:1px;margin:0;font-family:Arial,Helvetica,sans-serif}
      .ocp-sub{font-size:14px;margin-top:4px}
      .ocp-header{display:flex;align-items:center;gap:16px;margin-bottom:8px}
      .ocp-header img.logo{width:110px;height:110px;object-fit:contain}
      .ocp-form-title{text-align:center;font-weight:700;font-size:20px;margin:14px 0 10px;letter-spacing:1px}
      .ocp-field{font-size:16px;margin:6px 0;display:flex;align-items:baseline;gap:8px}
      .ocp-field b{min-width:130px;text-transform:uppercase;letter-spacing:.5px}
      .ocp-field .val{font-weight:700;border-bottom:1.5px dotted #222;flex:1;padding:0 6px 2px}
      .ocp-passport{position:absolute;right:0;top:150px;width:120px;height:150px;border:1px solid #333;background:#eee}
      .ocp-passport img{width:100%;height:100%;object-fit:cover}
      table.ocp-tbl{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
      table.ocp-tbl th,table.ocp-tbl td{border:1px solid #222;padding:8px}
      table.ocp-tbl th{background:#fff;font-weight:700;text-align:center}
      .ocp-nb{font-size:11px;margin-top:12px;line-height:1.6}
      .ocp-sign{display:flex;justify-content:space-between;margin-top:70px;font-size:12px}
      .ocp-carry-title{text-align:center;font-weight:700;margin:20px 0 6px;font-size:16px}
    </style>`;
  // Build watermark grid text
  const wmLine = Array.from({length:14}).map(()=>"ONDO CITY POLYTECHNIC").join(" &nbsp; ");
  const wmRows = Array.from({length:60}).map(()=>`<div>${wmLine}</div>`).join("");
  const body = `${watermarkCSS}
    <div class="ocp-print-wrap">
      <div class="ocp-watermark">${wmRows}</div>
      <div class="ocp-content">
        <div class="ocp-header">
          <img class="logo" src="assets/logo.png" alt="OCP"/>
          <div style="flex:1;text-align:center">
            <h1 class="ocp-title">ONDO CITY POLYTECHNIC</h1>
            <div class="ocp-sub">Campus 2, Adegoke Street, Arigbabola,</div>
            <div class="ocp-sub">Ondo City, Ondo State</div>
          </div>
        </div>
        <div style="position:relative;min-height:170px">
          <div class="ocp-form-title">COURSE REGISTRATION FORM</div>
          ${passport?`<div class="ocp-passport"><img src="${passport}"/></div>`:""}
          <div style="max-width:calc(100% - 140px)">
            <div class="ocp-field"><b>NAME:</b><span class="val">${(user.name||"").toUpperCase()}</span></div>
            <div class="ocp-field"><b>MATRIC NO:</b><span class="val">${matric}</span></div>
            <div class="ocp-field"><b>DEPARTMENT:</b><span class="val">${dept}</span></div>
            <div class="ocp-field"><b>FACULTY:</b><span class="val" style="max-width:55%">${faculty}</span><b style="min-width:60px">LEVEL:</b><span class="val">${level}</span></div>
            <div class="ocp-field"><b>SEMESTER:</b><span class="val" style="max-width:55%">${semester}</span><b style="min-width:80px">SESSION:</b><span class="val">${session}</span></div>
          </div>
        </div>
        <table class="ocp-tbl">
          <thead><tr><th>S/N</th><th>COURSE<br/>CODE</th><th>COURSE TITLE</th><th>COURSE<br/>UNIT</th><th>COURSE<br/>STATUS</th><th>LECTURER'S<br/>SIGN</th></tr></thead>
          <tbody>${rows}
            <tr><td colspan="3" style="text-align:right;font-weight:700">TOTAL UNITS COURSE</td><td style="text-align:center;font-weight:700">${totalUnits}</td><td colspan="2"></td></tr>
          </tbody>
        </table>
        <p style="font-size:12px;margin:14px 0 4px"><b>DATE PRINTED:</b> ${new Date().toLocaleDateString()}</p>
        <div class="ocp-carry-title">CARRY OVER COURSE REGISTRATION</div>
        <table class="ocp-tbl">
          <thead><tr><th>S/N</th><th>COURSE<br/>CODE</th><th>COURSE TITLE</th><th>COURSE<br/>UNIT</th><th>COURSE<br/>STATUS</th><th>LECTURER'S<br/>SIGN</th></tr></thead>
          <tbody>${emptyCarry}</tbody>
        </table>
        <div class="ocp-nb">
          <b>N.B:</b><br/>
          1. EACH CARRY OVER ATTRACTS FIVE THOUSAND NAIRA ONLY (₦5,000:00K)<br/>
          2. FOUR CARRY OVERS IS AUTOMATIC WITHDRAWAL FOR DENTAL NURSING SCIENCE DEPARTMENT<br/>
          3. EACH COURSE REGISTRATION IS THREE HUNDRED NAIRA ONLY (₦300:00K)<br/>
          4. DIRECTOR OF ACADEMIC AFFAIRS STAMP/SIGNATURE IS ONE THOUSAND NAIRA ONLY (₦1,000:00K)
        </div>
        <div class="ocp-sign">
          <div style="text-align:center">__________________________<br/><b>STUDENT'S SIGNATURE</b></div>
          <div style="text-align:center">_______________________________<br/><b>MR. NURUDEEN A. K.</b><br/>DIRECTOR OF ACADEMIC AFFAIRS</div>
        </div>
      </div>
    </div>`;
  _openPrint("Course Form — "+user.name, body);
  return;
  // Legacy body retained for reference (unreachable)
  const _legacy = `
    <table style="width:100%;border-collapse:collapse;font-size:12px" border="1" cellpadding="6">
      <thead>
        <tr style="background:#f0f0f0;font-weight:700;text-align:center">
          <th>S/N</th><th>COURSE CODE</th><th>COURSE TITLE</th><th>COURSE UNIT</th><th>COURSE STATUS</th><th>LECTURER'S SIGN</th>
        </tr>
      </thead>
      <tbody>${rows}
        <tr><td colspan="3" style="text-align:right;font-weight:700">TOTAL UNITS</td><td style="text-align:center;font-weight:700">${totalUnits}</td><td colspan="2"></td></tr>
      </tbody>
    </table>
    <p style="font-size:12px;margin:10px 0 4px"><b>DATE PRINTED:</b> ${new Date().toLocaleDateString()}</p>
    <h3 style="margin:16px 0 6px;text-align:center;text-decoration:underline">CARRY OVER COURSE REGISTRATION</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px" border="1" cellpadding="6">
      <thead>
        <tr style="background:#f0f0f0;font-weight:700;text-align:center">
          <th>S/N</th><th>COURSE CODE</th><th>COURSE TITLE</th><th>COURSE UNIT</th><th>COURSE STATUS</th><th>LECTURER'S SIGN</th>
        </tr>
      </thead>
      <tbody>${emptyCarry}</tbody>
    </table>
    <div style="font-size:11px;margin-top:10px;line-height:1.5">
      <b>N.B:</b><br/>
      1. EACH CARRY OVER ATTRACTS FIVE THOUSAND NAIRA ONLY (₦5,000:00K)<br/>
      2. FOUR CARRY OVERS IS AUTOMATIC WITHDRAWAL FOR DENTAL NURSING SCIENCE DEPARTMENT<br/>
      3. EACH COURSE REGISTRATION IS THREE HUNDRED NAIRA ONLY (₦300:00K)<br/>
      4. DIRECTOR OF ACADEMIC AFFAIRS STAMP/SIGNATURE IS ONE THOUSAND NAIRA ONLY (₦1,000:00K)
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:60px;font-size:12px">
      <div style="text-align:center">__________________________<br/><b>STUDENT'S SIGNATURE</b></div>
      <div style="text-align:center">_______________________________<br/><b>MR. NURUDEEN A. K.</b><br/>DIRECTOR OF ACADEMIC AFFAIRS</div>
    </div>`;
}

// ID Card removed — keep a no-op so old references don't break
function printIdCard(){ alert("ID Card feature has been removed."); }

function toast(msg){
  let t=document.getElementById("toast");
  if(!t){t=document.createElement("div");t.id="toast";t.className="toast";document.body.appendChild(t);}
  t.textContent=msg;t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2800);
}

function fileToDataURL(file){
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });
}

// ========================================================
// Image handling for uploads (passports, O'Level / JAMB / birth docs, proof).
//   Photos are downscaled + recompressed to JPEG so MANY students can be
//   stored without filling the browser's localStorage quota. This is what
//   previously caused only ONE applicant to be saved/approved before the
//   storage filled up and later writes were silently lost.
//   PDFs (and other non-image files) are kept as-is.
// ========================================================
async function compressImageFile(file, maxDim=1200, quality=0.72){
  const dataUrl = await fileToDataURL(file);
  if(!file.type || !file.type.startsWith("image/")) return dataUrl; // e.g. PDF — keep original
  try{
    const img = await new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=dataUrl; });
    let { width:w, height:h } = img;
    if(w > maxDim || h > maxDim){
      const scale = maxDim / Math.max(w, h);
      w = Math.round(w*scale); h = Math.round(h*scale);
    }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  }catch(e){ return dataUrl; }
}
// Compress an uploaded file and store it in the Assets store; returns a small key.
async function storeImageAsset(file, idHint){
  if(!file) return null;
  const dataUrl = await compressImageFile(file);
  return _storeAssetIfNeeded(dataUrl, idHint || "img");
}

// ========================================================
// Proof-of-payment viewer (used by Admin before confirming money).
//   Opens an in-page modal so the admin always sees the proof — opening a
//   data: URL directly in a new tab is blocked by modern browsers.
// ========================================================
function openProofModal(src, title){
  if(!src){ alert("No proof file was uploaded for this payment."); return; }
  const isPdf = /^data:application\/pdf/i.test(src) || /\.pdf($|\?)/i.test(src);
  const old = document.getElementById("__proofModal"); if(old) old.remove();
  const wrap = document.createElement("div");
  wrap.id = "__proofModal";
  wrap.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px";
  const inner = isPdf
    ? `<iframe src="${src}" style="width:90vw;height:85vh;border:0;background:#fff;border-radius:8px"></iframe>`
    : `<img src="${src}" alt="Proof of payment" style="max-width:90vw;max-height:85vh;object-fit:contain;background:#fff;border-radius:8px"/>`;
  wrap.innerHTML = `
    <div style="position:relative;display:flex;flex-direction:column;align-items:center;gap:12px">
      <div style="color:#fff;font-weight:600">${title||"Proof of Payment"}</div>
      ${inner}
      <div style="display:flex;gap:10px">
        <a href="${src}" download="proof" class="btn btn-green" style="padding:6px 16px;font-size:13px">⬇ Download</a>
        <button class="btn btn-ghost" style="padding:6px 16px;font-size:13px;background:#fff" onclick="document.getElementById('__proofModal').remove()">Close ✕</button>
      </div>
    </div>`;
  wrap.addEventListener("click", e=>{ if(e.target===wrap) wrap.remove(); });
  document.body.appendChild(wrap);
}


// ========================================================
// Auto wire nav
// ========================================================
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".nav-links").forEach(nav=>{
    if(!nav.querySelector('a[href="gallery.html"]')){
      const g = document.createElement("a"); g.href="gallery.html"; g.textContent="Gallery";
      nav.appendChild(g);
    }
    if(!nav.querySelector('a[href="screening.html"]')){
      const s = document.createElement("a"); s.href="screening.html"; s.textContent="Screening";
      nav.insertBefore(s, nav.children[2]||null);
    }
  });
  const me = Auth.current();
  document.querySelectorAll("[data-nav-auth]").forEach(el=>{
    if(me){
      el.innerHTML = `<a href="dashboard.html" class="btn btn-ghost">Dashboard</a>
        <button class="btn btn-primary" onclick="Auth.logout()">Sign out</button>`;
    }
  });
  applyMessages();
});

// ========================================================
// Admission Approval Polling Popup
// ========================================================
function startAdmissionPolling(scrId){
  if(!scrId) return;
  function findScr(){ return (DB.screenings||[]).find(s=>s.id===scrId); }
  function ensureModal(){
    let m = document.getElementById("admPopup");
    if(m) return m;
    m = document.createElement("div");
    m.id = "admPopup";
    m.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px";
    m.innerHTML = `<div style="background:#fff;border-radius:14px;max-width:460px;width:100%;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.3);font-family:inherit">
      <div id="admPopupBody"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap">
        <button id="admPopupClose" class="btn btn-ghost">Close</button>
        <button id="admPopupGo" class="btn btn-primary" style="display:none">Continue →</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.querySelector("#admPopupClose").onclick = ()=>{ m.style.display="none"; };
    return m;
  }
  function tick(){
    const scr = findScr(); if(!scr) return;
    const m = ensureModal();
    const body = m.querySelector("#admPopupBody");
    const goBtn = m.querySelector("#admPopupGo");
    if(/Admitted/i.test(scr.status)){
      const isPT = /Part-?Time/i.test(scr.mode||"") || /^PT-/i.test(scr.id||"");
      const isNonJambite = !scr.jamb;
      const loginHint = (isPT || isNonJambite)
        ? `Use your <strong>Application No.</strong> (<code>${scr.id}</code>) and your <strong>first name</strong> (lowercase) to login.`
        : `Use your <strong>JAMB Number</strong> (<code>${scr.jamb}</code>) and your <strong>first name</strong> (lowercase) to login.`;
      body.innerHTML = `<h3 style="margin:0 0 8px;color:#15532a">🎉 Congratulations, ${scr.name.split(" ")[0]}!</h3>
        <p style="margin:0 0 10px">You have been <strong>admitted</strong>. ${loginHint}</p>
        <p class="sub" style="color:#666;margin:10px 0 0">Download your documents below or login to continue.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
          <button class="btn btn-ghost" onclick='printConfirmationSlip(${JSON.stringify(scr).replace(/'/g,"&#39;")})'>📄 Confirmation Slip</button>
          <button class="btn btn-ghost" onclick='printAdmissionNotification(${JSON.stringify(scr).replace(/'/g,"&#39;")})'>📧 Admission Notification</button>
        </div>`;
      goBtn.style.display = "";
      goBtn.onclick = ()=> location.href = "login.html";
    } else if(/Not Admitted|Rejected/i.test(scr.status)){
      body.innerHTML = `<h3 style="margin:0 0 8px;color:#a02020">YOUR ADMISSION IS NOT ACCEPTED</h3>
        <p>Application: <strong>${scr.id}</strong></p>
        ${scr.declineReason?`<p class="sub" style="color:#666">Reason: ${scr.declineReason}</p>`:''}`;
      goBtn.style.display = "none";
    } else {
      body.innerHTML = `<h3 style="margin:0 0 8px">⏳ Awaiting Admin Approval</h3>
        <p>Your application <strong>${scr.id}</strong> is still under review.</p>
        <p class="sub" style="color:#666">We'll keep checking every 10 seconds.</p>`;
      goBtn.style.display = "none";
    }
    m.style.display = "flex";
  }
  setTimeout(tick, 1000);
  setInterval(tick, 10000);
}

// Helper: admin confirms a pending payment
function adminConfirmPayment(payId){
  const all = DB.payments; const i = all.findIndex(p=>p.id===payId);
  if(i<0) return false;
  all[i].status = "paid";
  all[i].confirmedAt = Date.now();
  if(all[i].invoiceId){
    const inv = DB.invoices; const ii = inv.findIndex(x=>x.id===all[i].invoiceId);
    if(ii>-1){ inv[ii].status = "paid"; inv[ii].paidAt = Date.now(); DB.invoices = inv; }
  }
  DB.payments = all;
  notifyAdminOfPayment(all[i], "confirmed");
  // Mailto: notify student of confirmation
  const u = DB.users.find(x=>x.id===all[i].userId);
  if(u && u.email){
    const subject = encodeURIComponent("[OCPOTECH] Payment Confirmed — "+all[i].label);
    const body    = encodeURIComponent(`Hello ${u.name},\n\nYour payment for ${all[i].label} (NGN ${all[i].amount.toLocaleString()}, ref ${all[i].reference||all[i].tx_ref}) has been CONFIRMED.\n\nYou can now continue with the rest of your registration.\n\n— OCPOTECH Bursary`);
    window.open(`mailto:${u.email}?subject=${subject}&body=${body}`,"_blank");
  }
  return true;
}
