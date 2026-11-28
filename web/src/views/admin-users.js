// إدارة المستخدمين: طرق الدخول، وإضافة متدرب بكلمة مرور مؤقتة، والاستيراد والتصدير بملفات Excel.
// الإنشاء من المتصفح (الخطة المجانية): نسخة ثانية من Firebase Auth في الذاكرة تنشئ الحساب،
// فلا تتأثر جلسة المشرف. ويُكتب ملف المتدرب مع mustChangePassword فيغيّر كلمة المرور في أول دخول.
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, auth, db, useEmulators } from "../firebase.js";
import { emptyProgress } from "../engine.js";
import { AUTH_DEFAULTS, loadCourses, loadPublicSettings } from "../store.js";
import { duration, loadAllUsers, summarize } from "../admin-data.js";
import { ar, errorMessage, esc, spinner, toast } from "../ui.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** كلمة مرور مؤقتة سهلة الإملاء: حروف وأرقام بلا رموز ملتبسة (0/O، 1/l). */
export function tempPassword(len = 10) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint32Array(len));
  return Array.from(r, (n) => chars[n % chars.length]).join("");
}

/** ينشئ حساباً جديداً دون المساس بجلسة المشرف. */
async function createTrainee({ name, email, password }) {
  const sec = initializeApp(app.options, `create-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  try {
    const secAuth = initializeAuth(sec, { persistence: inMemoryPersistence });
    if (useEmulators) connectAuthEmulator(secAuth, `http://${location.hostname}:9099`, { disableWarnings: true });
    const cred = await createUserWithEmailAndPassword(secAuth, email, password);
    await updateProfile(cred.user, { displayName: name });
    await signOut(secAuth);
    await setDoc(doc(db, "users", cred.user.uid), {
      ...emptyProgress(name),
      email: email.toLowerCase(),
      mustChangePassword: true,
      createdByAdmin: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return cred.user.uid;
  } finally {
    await deleteApp(sec).catch(() => {});
  }
}

const dateStr = (d) => (d ? d.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" }) : "—");

export async function render(el) {
  el.innerHTML = spinner();
  const [pub, courses, users] = await Promise.all([loadPublicSettings(), loadCourses(true), loadAllUsers()]);
  const opts = { ...AUTH_DEFAULTS, ...pub.auth };
  let rows = users.map((u) => summarize(u, courses)).sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name, "ar"));

  el.innerHTML = `
    <a class="back" href="#/admin">→ لوحة التحكم</a>
    <h1 class="page-title">👥 المستخدمون</h1>

    <form class="card form" id="auth-opts">
      <h2>🔑 خيارات الدخول</h2>
      <label class="check"><input type="checkbox" name="email" ${opts.email ? "checked" : ""}/> الدخول بالبريد الإلكتروني وكلمة المرور</label>
      <label class="check"><input type="checkbox" name="google" ${opts.google ? "checked" : ""}/> الدخول بحساب Google</label>
      <label class="check"><input type="checkbox" name="signup" ${opts.signup ? "checked" : ""}/> السماح بإنشاء حساب جديد من صفحة الدخول</label>
      <p class="muted small">عند إلغاء «إنشاء حساب جديد» لا يدخل المنصة إلا من أضفته أنت هنا أو استوردته من Excel.
        وطرق الدخول نفسها يجب أن تكون مفعّلة كذلك في Firebase Console ← Authentication ← Sign-in method.</p>
      <button class="btn primary" type="submit">حفظ خيارات الدخول</button>
    </form>

    <form class="card form" id="add-user" novalidate>
      <h2>➕ إضافة متدرب</h2>
      <div class="grid-2 tight">
        <label class="field">الاسم<input name="name" required maxlength="60" /></label>
        <label class="field">البريد الإلكتروني<input name="email" type="email" dir="ltr" required /></label>
      </div>
      <label class="field">كلمة المرور المؤقتة
        <span class="row"><input name="password" dir="ltr" minlength="8" required value="${tempPassword()}" />
        <button class="btn small" type="button" id="regen">توليد</button></span>
      </label>
      <p class="muted small">أعطِ المتدرب البريد وكلمة المرور المؤقتة؛ وسيُطلب منه اختيار كلمة مرور جديدة في أول دخول.</p>
      <p class="form-error" role="alert"></p>
      <button class="btn primary" type="submit">إنشاء الحساب</button>
    </form>

    <section class="card form">
      <h2>📥 استيراد متدربين من Excel</h2>
      <p class="muted">ملف ‎.xlsx‎ أعمدته بالترتيب: <b>الاسم</b>، <b>البريد الإلكتروني</b>، <b>كلمة المرور المؤقتة</b> (اختيارية؛ إن تُركت فارغة نولّدها).
        الصف الأول عناوين.</p>
      <div class="row wrap">
        <button class="btn small" id="template">⬇️ تنزيل نموذج فارغ</button>
        <label class="btn primary small">اختر ملف Excel<input type="file" id="import-file" accept=".xlsx" hidden /></label>
      </div>
      <div id="import-log" aria-live="polite"></div>
    </section>

    <section class="card">
      <div class="row wrap between">
        <h2>قائمة المتدربين (${ar(rows.length)})</h2>
        <span class="row wrap">
          <input type="search" id="q" placeholder="ابحث بالاسم أو البريد" aria-label="بحث" />
          <button class="btn primary small" id="export">⬇️ تصدير Excel</button>
          <a class="btn small" href="#/admin/reports">📊 التقارير</a>
        </span>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>المتدرب</th><th>التقدّم</th><th>المهارات المجتازة</th><th>المهام</th><th>مرات الفتح</th><th>مدة النشاط</th><th>آخر ظهور</th><th></th></tr></thead>
        <tbody></tbody>
      </table></div>
    </section>`;

  // ---- خيارات الدخول
  const optsForm = el.querySelector("#auth-opts");
  optsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const next = { email: optsForm.email.checked, google: optsForm.google.checked, signup: optsForm.signup.checked };
    if (!next.email && !next.google && !confirm("أوقفت كل طرق الدخول، فلن يستطيع أحد الدخول (ولا أنت بعد خروجك). متأكد؟")) return;
    try {
      await setDoc(doc(db, "settings", "public"), { auth: next }, { merge: true });
      toast("حُفظت خيارات الدخول.", "success");
    } catch (err) {
      toast(errorMessage(err));
    }
  });

  // ---- إضافة متدرب
  const addForm = el.querySelector("#add-user");
  const addErr = addForm.querySelector(".form-error");
  el.querySelector("#regen").addEventListener("click", () => (addForm.password.value = tempPassword()));
  addForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    addErr.textContent = "";
    const name = addForm.name.value.trim();
    const email = addForm.email.value.trim();
    const password = addForm.password.value.trim();
    if (!name) return (addErr.textContent = "اكتب اسم المتدرب.");
    if (!EMAIL_RE.test(email)) return (addErr.textContent = "صيغة البريد الإلكتروني غير صحيحة.");
    if (password.length < 8) return (addErr.textContent = "كلمة المرور المؤقتة ثمانية أحرف على الأقل.");
    const btn = addForm.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      await createTrainee({ name, email, password });
      toast(`أُنشئ حساب ${name}. كلمة المرور المؤقتة: ${password}`, "success");
      render(el);
    } catch (err) {
      addErr.textContent = errorMessage(err);
      btn.disabled = false;
    }
  });

  // ---- نموذج Excel واستيراده
  el.querySelector("#template").addEventListener("click", async () => {
    const { default: writeXlsxFile } = await import("write-excel-file");
    const head = ["الاسم", "البريد الإلكتروني", "كلمة المرور المؤقتة (اختياري)"].map((value) => ({ value, fontWeight: "bold" }));
    await writeXlsxFile([head, [{ value: "مثال: أحمد علي" }, { value: "ahmad@example.com" }, { value: "" }]], {
      fileName: "نموذج-استيراد-المتدربين.xlsx",
      columns: [{ width: 28 }, { width: 34 }, { width: 30 }],
      rightToLeft: true,
    });
  });

  const log = el.querySelector("#import-log");
  el.querySelector("#import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const { default: readXlsxFile } = await import("read-excel-file");
    let sheet;
    try {
      sheet = await readXlsxFile(file);
    } catch {
      log.innerHTML = `<p class="form-error">تعذّرت قراءة الملف. تأكد أنه ‎.xlsx‎.</p>`;
      return;
    }
    const known = new Set(users.map((u) => String(u.email || "").toLowerCase()));
    const items = sheet
      .slice(1)
      .map((r, i) => ({
        row: i + 2,
        name: String(r[0] ?? "").trim(),
        email: String(r[1] ?? "").trim().toLowerCase(),
        password: String(r[2] ?? "").trim(),
      }))
      .filter((x) => x.name || x.email);
    if (!items.length) {
      log.innerHTML = `<p class="form-error">لا توجد صفوف بعد صف العناوين.</p>`;
      return;
    }
    if (!confirm(`سيُنشأ ${items.length} حساباً. متابعة؟`)) return;
    const results = [];
    log.innerHTML = `<p>${spinner("جارٍ الإنشاء…")}</p><div class="bar"><span style="width:0%"></span></div>`;
    for (const [k, it] of items.entries()) {
      let status;
      if (!it.name) status = "بلا اسم";
      else if (!EMAIL_RE.test(it.email)) status = "بريد غير صحيح";
      else if (known.has(it.email)) status = "موجود مسبقاً";
      else {
        if (it.password.length < 8) it.password = tempPassword();
        try {
          await createTrainee(it);
          known.add(it.email);
          status = "أُنشئ";
        } catch (err) {
          status = errorMessage(err);
        }
      }
      results.push({ ...it, status });
      log.querySelector(".bar span").style.width = `${Math.round(((k + 1) / items.length) * 100)}%`;
    }
    const ok = results.filter((r) => r.status === "أُنشئ");
    log.innerHTML = `<p><b>أُنشئ ${ar(ok.length)} من ${ar(results.length)} حساب.</b> نزّل ملف النتائج ففيه كلمات المرور المؤقتة لتسليمها للمتدربين.</p>
      <button class="btn primary small" id="dl-results">⬇️ تنزيل النتائج (Excel)</button>
      ${results.some((r) => r.status !== "أُنشئ") ? `<ul class="small">${results.filter((r) => r.status !== "أُنشئ").map((r) => `<li>الصف ${ar(r.row)}: ${esc(r.email || r.name)} ← ${esc(r.status)}</li>`).join("")}</ul>` : ""}`;
    log.querySelector("#dl-results").addEventListener("click", async () => {
      const { default: writeXlsxFile } = await import("write-excel-file");
      const head = ["الاسم", "البريد الإلكتروني", "كلمة المرور المؤقتة", "النتيجة"].map((value) => ({ value, fontWeight: "bold" }));
      await writeXlsxFile(
        [head, ...results.map((r) => [r.name, r.email, r.status === "أُنشئ" ? r.password : "", r.status].map((value) => ({ value })))],
        { fileName: "نتائج-الاستيراد.xlsx", columns: [{ width: 28 }, { width: 34 }, { width: 22 }, { width: 30 }], rightToLeft: true },
      );
    });
    if (ok.length) {
      toast(`أُنشئ ${ok.length} حساباً.`, "success");
      // تحديث القائمة دون مسح نتائج الاستيراد
      rows = (await loadAllUsers()).map((u) => summarize(u, courses));
      paint();
    }
  });

  // ---- الجدول والتصدير
  const tbody = el.querySelector("tbody");
  function paint() {
    const q = el.querySelector("#q").value.trim().toLowerCase();
    const list = rows.filter((r) => !q || r.name.toLowerCase().includes(q) || r.email.includes(q));
    tbody.innerHTML = list.length
      ? list
          .map(
            (r) => `<tr>
        <td><b>${esc(r.name)}</b><div class="muted small" dir="ltr">${esc(r.email)}</div>${r.mustChangePassword ? '<span class="tag">لم يدخل بعد</span>' : ""}</td>
        <td><div class="bar small" role="progressbar" aria-valuenow="${r.progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${r.progress}%"></span></div>
          <span class="small">${ar(r.progress)}% · ${ar(r.lessonsDone)}/${ar(r.totalLessons)} درس</span></td>
        <td>${ar(r.skillsPassed)} / ${ar(r.totalSkills)}</td>
        <td>${ar(r.tasksSubmitted)}</td>
        <td>${ar(r.visits)}</td>
        <td>${duration(r.activeSeconds)}</td>
        <td class="small">${dateStr(r.lastSeen)}</td>
        <td>${r.email ? `<button class="btn ghost small reset" data-email="${esc(r.email)}" title="إرسال رابط تغيير كلمة المرور">🔑</button>` : ""}</td>
      </tr>`,
          )
          .join("")
      : `<tr><td colspan="8" class="muted">لا نتائج.</td></tr>`;
  }
  paint();
  el.querySelector("#q").addEventListener("input", paint);
  tbody.addEventListener("click", async (e) => {
    const b = e.target.closest(".reset");
    if (!b || !confirm(`إرسال رابط تغيير كلمة المرور إلى ${b.dataset.email}؟`)) return;
    try {
      await sendPasswordResetEmail(auth, b.dataset.email);
      toast("أُرسل الرابط.", "success");
    } catch (err) {
      toast(errorMessage(err));
    }
  });

  el.querySelector("#export").addEventListener("click", () => exportUsers(rows, courses));
}

/** ملف Excel: ورقة ملخص لكل متدرب، وورقة المهارات المجتازة. */
export async function exportUsers(rows, courses) {
  const { default: writeXlsxFile } = await import("write-excel-file");
  const live = courses.filter((c) => !c.comingSoon).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const H = (value) => ({ value, fontWeight: "bold", backgroundColor: "#E6F4F1" });
  const summary = [
    ["الاسم", "البريد الإلكتروني", "نسبة التقدّم %", "الدروس المكتملة", "المهارات المجتازة", "المهام المرفوعة", "المهام المجتازة",
      "نقاط الخبرة", "مرات فتح المنصة", "مدة النشاط (دقيقة)", "آخر ظهور", "تاريخ الإنشاء"].map(H),
    ...rows.map((r) => [
      { value: r.name },
      { value: r.email },
      { type: Number, value: r.progress },
      { type: Number, value: r.lessonsDone },
      { type: Number, value: r.skillsPassed },
      { type: Number, value: r.tasksSubmitted },
      { type: Number, value: r.tasksPassed },
      { type: Number, value: r.xp },
      { type: Number, value: r.visits },
      { type: Number, value: Math.round(r.activeSeconds / 60) },
      r.lastSeen ? { type: Date, value: r.lastSeen, format: "yyyy-mm-dd hh:mm" } : null,
      r.createdAt ? { type: Date, value: r.createdAt, format: "yyyy-mm-dd" } : null,
    ]),
  ];
  const skills = [
    [H("الاسم"), H("البريد الإلكتروني"), ...live.map((c) => H(`${c.number ?? c.order ?? ""}. ${c.title}`))],
    ...rows.map((r) => [{ value: r.name }, { value: r.email }, ...live.map((c) => ({ value: r.passedIds.includes(c.id) ? "✓ مجتازة" : "" }))]),
  ];
  const stamp = new Date().toISOString().slice(0, 10);
  await writeXlsxFile([summary, skills], {
    sheets: ["تقدّم المتدربين", "المهارات المجتازة"],
    columns: [
      [{ width: 26 }, { width: 32 }, ...Array(10).fill({ width: 16 })],
      [{ width: 26 }, { width: 32 }, ...live.map(() => ({ width: 22 }))],
    ],
    fileName: `تقرير-المتدربين-${stamp}.xlsx`,
    rightToLeft: true,
    stickyRowsCount: 1,
  });
}
