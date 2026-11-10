// منصة التدريب التعاوني - Backend (Node.js + Express)
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || "غيّر-هذا-السر-قبل-النشر";
const DB_FILE = path.join(__dirname, "data.json");
const ROLES = ["company", "supervisor", "student"];

// ---------- تخزين بسيط في ملف JSON (يمكن استبداله بقاعدة بيانات لاحقاً) ----------
let db = { users: [], opportunities: [], applications: [], reports: [] };
if (fs.existsSync(DB_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, supervisorId: u.supervisorId || null });

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ---------- المصادقة ----------
const auth = (req, res, next) => {
  const t = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    const p = jwt.verify(t, SECRET);
    const u = db.users.find((x) => x.id === p.id);
    if (!u) throw 0;
    req.user = u;
    next();
  } catch { res.status(401).json({ error: "غير مصرّح، سجّل الدخول" }); }
};
const only = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: "ليست لديك صلاحية" });
const sign = (u) => jwt.sign({ id: u.id }, SECRET, { expiresIn: "7d" });

app.post("/api/register", (req, res) => {
  const { name, email, password, role, supervisorId } = req.body || {};
  if (!name || !email || !password || !ROLES.includes(role)) return res.status(400).json({ error: "بيانات ناقصة" });
  if (password.length < 6) return res.status(400).json({ error: "كلمة المرور 6 أحرف على الأقل" });
  if (db.users.some((u) => u.email === email.toLowerCase())) return res.status(409).json({ error: "البريد مسجّل مسبقاً" });
  const u = { id: uid(), name, email: email.toLowerCase(), role, passwordHash: bcrypt.hashSync(password, 10) };
  if (role === "student") {
    if (!db.users.some((s) => s.id === supervisorId && s.role === "supervisor")) return res.status(400).json({ error: "اختر المشرف الأكاديمي" });
    u.supervisorId = supervisorId;
  }
  db.users.push(u); save();
  res.json({ token: sign(u), user: pub(u) });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  const u = db.users.find((x) => x.email === (email || "").toLowerCase());
  if (!u || !bcrypt.compareSync(password || "", u.passwordHash)) return res.status(401).json({ error: "البريد أو كلمة المرور غير صحيحة" });
  res.json({ token: sign(u), user: pub(u) });
});

app.get("/api/supervisors", (req, res) =>
  res.json(db.users.filter((u) => u.role === "supervisor").map((u) => ({ id: u.id, name: u.name }))));
app.get("/api/me", auth, (req, res) => res.json(pub(req.user)));

// ---------- فرص التدريب ----------
app.get("/api/opportunities", auth, (req, res) => {
  const list = req.user.role === "company" ? db.opportunities.filter((o) => o.ownerId === req.user.id) : db.opportunities;
  res.json(list);
});
app.post("/api/opportunities", auth, only("company"), (req, res) => {
  const { title, field, desc, seats } = req.body || {};
  if (!title) return res.status(400).json({ error: "العنوان مطلوب" });
  const o = { id: uid(), title, field: field || "", desc: desc || "", seats: +seats || 1, ownerId: req.user.id, company: req.user.name, at: Date.now() };
  db.opportunities.push(o); save(); res.json(o);
});
app.delete("/api/opportunities/:id", auth, only("company"), (req, res) => {
  const i = db.opportunities.findIndex((o) => o.id === req.params.id && o.ownerId === req.user.id);
  if (i < 0) return res.status(404).json({ error: "غير موجودة" });
  db.opportunities.splice(i, 1); save(); res.json({ ok: true });
});

// ---------- طلبات التدريب ----------
const visibleApps = (u) => {
  if (u.role === "student") return db.applications.filter((a) => a.studentId === u.id);
  if (u.role === "company") { const ids = db.opportunities.filter((o) => o.ownerId === u.id).map((o) => o.id); return db.applications.filter((a) => ids.includes(a.oppId)); }
  const sids = db.users.filter((s) => s.supervisorId === u.id).map((s) => s.id);
  return db.applications.filter((a) => sids.includes(a.studentId));
};
app.get("/api/applications", auth, (req, res) => {
  const opp = (id) => db.opportunities.find((o) => o.id === id);
  res.json(visibleApps(req.user).map((a) => ({ ...a, oppTitle: opp(a.oppId)?.title || "(محذوفة)", company: opp(a.oppId)?.company || "" })));
});
app.post("/api/applications", auth, only("student"), (req, res) => {
  const { oppId } = req.body || {};
  if (!db.opportunities.some((o) => o.id === oppId)) return res.status(404).json({ error: "الفرصة غير موجودة" });
  if (db.applications.some((a) => a.oppId === oppId && a.studentId === req.user.id)) return res.status(409).json({ error: "قدّمت مسبقاً" });
  const a = { id: uid(), oppId, studentId: req.user.id, studentName: req.user.name, status: "pending", companyScore: null, academicScore: null, at: Date.now() };
  db.applications.push(a); save(); res.json(a);
});
const myApp = (req, list) => list(req.user).find((a) => a.id === req.params.id);
app.patch("/api/applications/:id/status", auth, only("company"), (req, res) => {
  const a = myApp(req, visibleApps); const s = req.body.status;
  if (!a || !["accepted", "rejected"].includes(s)) return res.status(400).json({ error: "طلب غير صالح" });
  a.status = s; save(); res.json(a);
});
const score = (field, role) => (req, res) => {
  const a = myApp(req, visibleApps); const v = Number(req.body.score);
  if (!a || a.status !== "accepted" || isNaN(v) || v < 0 || v > 100) return res.status(400).json({ error: "قيمة بين 0 و100 لمتدرب مقبول" });
  a[field] = v; save(); res.json(a);
};
app.patch("/api/applications/:id/company-score", auth, only("company"), score("companyScore"));
app.patch("/api/applications/:id/academic-score", auth, only("supervisor"), score("academicScore"));

// ---------- التقارير الأسبوعية ----------
app.get("/api/reports", auth, (req, res) => {
  const ids = visibleApps(req.user).map((a) => a.id);
  res.json(db.reports.filter((r) => ids.includes(r.appId)).map((r) => ({ ...r, studentName: db.users.find((u) => u.id === r.studentId)?.name })));
});
app.post("/api/reports", auth, only("student"), (req, res) => {
  const { appId, week, text } = req.body || {};
  const a = db.applications.find((x) => x.id === appId && x.studentId === req.user.id && x.status === "accepted");
  if (!a || !text || !week) return res.status(400).json({ error: "بيانات غير صالحة" });
  const r = { id: uid(), appId, studentId: req.user.id, week, text, status: "submitted", comment: "", at: Date.now() };
  db.reports.push(r); save(); res.json(r);
});
app.patch("/api/reports/:id/review", auth, only("supervisor"), (req, res) => {
  const ids = visibleApps(req.user).map((a) => a.id);
  const r = db.reports.find((x) => x.id === req.params.id && ids.includes(x.appId));
  const s = req.body.status;
  if (!r || !["approved", "returned"].includes(s)) return res.status(400).json({ error: "طلب غير صالح" });
  r.status = s; r.comment = req.body.comment || ""; save(); res.json(r);
});

app.listen(PORT, () => console.log(`✅ المنصة تعمل على http://localhost:${PORT}`));
