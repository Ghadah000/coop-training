const token = localStorage.token;
if (!token) location.href = "index.html";
const ROLES = { company: "جهة التدريب", supervisor: "المشرف الأكاديمي", student: "الطالب" };
const ST = { pending: ["قيد المراجعة", "wa"], accepted: ["مقبول", "ok"], rejected: ["مرفوض", "no"], submitted: ["بانتظار الاعتماد", "wa"], approved: ["معتمد", "ok"], returned: ["معاد للتعديل", "no"] };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tag = (s) => `<span class="tag ${ST[s][1]}">${ST[s][0]}</span>`;
const final = (a) => (a.academicScore != null && a.companyScore != null ? Math.round(a.academicScore * 0.5 + a.companyScore * 0.5) : null);
let me, S = { opps: [], apps: [], reps: [] }, tab = null;

async function api(url, method = "GET", body) {
  const r = await fetch("/api/" + url, { method, headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { localStorage.removeItem("token"); location.href = "index.html"; }
  if (!r.ok) throw new Error(d.error || "حدث خطأ");
  return d;
}
async function load() {
  [S.opps, S.apps, S.reps] = await Promise.all([api("opportunities"), api("applications"), api("reports")]);
  render();
}
// تنفيذ عملية ثم إعادة التحميل
const run = (fn) => async () => { try { await fn(); await load(); } catch (e) { alert(e.message); } };
const on = (sel, fn) => document.querySelectorAll(sel).forEach((b) => (b.onclick = run(() => fn(b.dataset))));

function tabs(items, body) {
  if (!items.find((i) => i[0] === tab)) tab = items[0][0];
  $("#app").innerHTML = `<nav>${items.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? "on" : ""}">${l}</button>`).join("")}</nav>${body(tab)}`;
  document.querySelectorAll("[data-t]").forEach((b) => (b.onclick = () => { tab = b.dataset.t; render(); }));
}
function render() { ({ company: vCompany, supervisor: vSup, student: vStudent })[me.role](); }

/* ---------- جهة التدريب ---------- */
function vCompany() {
  const pend = S.apps.filter((a) => a.status === "pending").length;
  tabs([["opps", "فرصي"], ["apps", `الطلبات (${pend})`], ["eval", "التقييم"]], (t) => {
    if (t === "opps") return `<div class="card"><h2 style="margin-top:0">نشر فرصة تدريب</h2>
      <input id="t" placeholder="عنوان الفرصة"><input id="f" placeholder="المجال"><input id="n" type="number" min="1" value="1">
      <textarea id="d" rows="3" placeholder="الوصف والمهام"></textarea><button id="add">نشر</button></div>` +
      (S.opps.map((o) => `<div class="card"><b>${esc(o.title)}</b> <span class="mu">${esc(o.field)} · ${o.seats} مقعد</span><p>${esc(o.desc)}</p><button class="d" data-del="${o.id}">حذف</button></div>`).join("") || '<p class="mu">لم تنشر فرصاً بعد.</p>');
    if (t === "apps") return S.apps.map((a) => `<div class="card"><b>${esc(a.studentName)}</b> ${tag(a.status)}<div class="mu">${esc(a.oppTitle)}</div>
      ${a.status === "pending" ? `<div class="row" style="margin-top:8px"><button data-st="accepted" data-id="${a.id}">قبول</button><button class="d" data-st="rejected" data-id="${a.id}">رفض</button></div>` : ""}</div>`).join("") || '<p class="mu">لا توجد طلبات.</p>';
    return S.apps.filter((a) => a.status === "accepted").map((a) => `<div class="card"><b>${esc(a.studentName)}</b> <span class="mu">${esc(a.oppTitle)}</span>
      <label class="mu">تقييم الجهة (من 100)</label><input type="number" min="0" max="100" id="sc${a.id}" value="${a.companyScore ?? ""}"><button data-sc="${a.id}">حفظ التقييم</button></div>`).join("") || '<p class="mu">لا يوجد متدربون مقبولون.</p>';
  });
  $("#add") && ($("#add").onclick = run(() => api("opportunities", "POST", { title: $("#t").value, field: $("#f").value, seats: $("#n").value, desc: $("#d").value })));
  on("[data-del]", (d) => api("opportunities/" + d.del, "DELETE"));
  on("[data-st]", (d) => api(`applications/${d.id}/status`, "PATCH", { status: d.st }));
  on("[data-sc]", (d) => api(`applications/${d.sc}/company-score`, "PATCH", { score: $("#sc" + d.sc).value }));
}

/* ---------- المشرف الأكاديمي ---------- */
function vSup() {
  const reps = S.reps.filter((r) => r.status === "submitted");
  tabs([["rev", `التقارير (${reps.length})`], ["tr", "طلابي"]], (t) => {
    if (t === "rev") return reps.map((r) => `<div class="card"><b>${esc(r.studentName)}</b> <span class="mu">الأسبوع ${esc(r.week)}</span><p>${esc(r.text)}</p>
      <input id="c${r.id}" placeholder="ملاحظات المشرف"><div class="row"><button data-rv="approved" data-id="${r.id}">اعتماد</button><button class="d" data-rv="returned" data-id="${r.id}">إعادة للتعديل</button></div></div>`).join("") || '<p class="mu">لا توجد تقارير بانتظار المراجعة.</p>';
    return S.apps.filter((a) => a.status === "accepted").map((a) => {
      const n = S.reps.filter((r) => r.appId === a.id && r.status === "approved").length, f = final(a);
      return `<div class="card"><b>${esc(a.studentName)}</b> <span class="mu">${esc(a.oppTitle)} · ${esc(a.company)}</span>
      <div class="mu">تقارير معتمدة: ${n} · تقييم الجهة: ${a.companyScore ?? "—"}</div>
      <label class="mu">الدرجة الأكاديمية (من 100)</label><input type="number" min="0" max="100" id="g${a.id}" value="${a.academicScore ?? ""}">
      <button data-gr="${a.id}">حفظ</button> ${f != null ? `<b> النهائي: ${f}</b>` : ""}</div>`;
    }).join("") || '<p class="mu">لا يوجد متدربون مقبولون من طلابك.</p>';
  });
  on("[data-rv]", (d) => api(`reports/${d.id}/review`, "PATCH", { status: d.rv, comment: $("#c" + d.id).value }));
  on("[data-gr]", (d) => api(`applications/${d.gr}/academic-score`, "PATCH", { score: $("#g" + d.gr).value }));
}

/* ---------- الطالب ---------- */
function vStudent() {
  const acc = S.apps.filter((a) => a.status === "accepted");
  tabs([["opps", "الفرص"], ["my", "طلباتي"], ["rep", "التقارير"]], (t) => {
    if (t === "opps") return S.opps.map((o) => `<div class="card"><b>${esc(o.title)}</b><div class="mu">${esc(o.company)} · ${esc(o.field)} · ${o.seats} مقعد</div><p>${esc(o.desc)}</p>
      ${S.apps.some((a) => a.oppId === o.id) ? '<span class="tag">تم التقديم</span>' : `<button data-ap="${o.id}">تقديم</button>`}</div>`).join("") || '<p class="mu">لا توجد فرص حالياً.</p>';
    if (t === "my") return S.apps.map((a) => `<div class="card"><b>${esc(a.oppTitle)}</b> ${tag(a.status)}${final(a) != null ? `<div>الدرجة النهائية: <b>${final(a)}</b></div>` : ""}</div>`).join("") || '<p class="mu">لم تقدّم على أي فرصة.</p>';
    return (acc.length ? `<div class="card"><h2 style="margin-top:0">تقرير أسبوعي جديد</h2><select id="ra">${acc.map((a) => `<option value="${a.id}">${esc(a.oppTitle)}</option>`).join("")}</select>
      <input id="rw" type="number" min="1" placeholder="رقم الأسبوع"><textarea id="rt" rows="4" placeholder="ماذا أنجزت هذا الأسبوع؟"></textarea><button id="sub">إرسال</button></div>` : '<p class="mu">يمكنك رفع التقارير بعد قبول طلبك.</p>') +
      [...S.reps].sort((a, b) => b.at - a.at).map((r) => `<div class="card"><b>الأسبوع ${esc(r.week)}</b> ${tag(r.status)}<p>${esc(r.text)}</p>${r.comment ? `<div class="mu">ملاحظة المشرف: ${esc(r.comment)}</div>` : ""}</div>`).join("");
  });
  on("[data-ap]", (d) => api("applications", "POST", { oppId: d.ap }));
  $("#sub") && ($("#sub").onclick = run(() => api("reports", "POST", { appId: $("#ra").value, week: $("#rw").value, text: $("#rt").value })));
}

$("#out").onclick = () => { localStorage.removeItem("token"); location.href = "index.html"; };
(async () => {
  try { me = await api("me"); $("#who").textContent = `${me.name} · ${ROLES[me.role]}`; await load(); }
  catch (e) { $("#app").textContent = e.message; }
})();
