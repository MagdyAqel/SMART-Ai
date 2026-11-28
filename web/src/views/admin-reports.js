// تقارير مرئية للمشرف: مؤشرات عامة، وتوزيع التقدّم، والمهارات المجتازة، والمهام المرفوعة، والنشاط اليومي.
// كل رسم سلسلة واحدة بلون واحد (لا مفتاح ألوان)، والقيمة تظهر عند المرور أو التركيز، ومع كل رسم جدول بياناته.
import { loadCourses } from "../store.js";
import { duration, loadAllUsers, summarize } from "../admin-data.js";
import { exportUsers } from "./admin-users.js";
import { ar, esc, spinner } from "../ui.js";

const DAY = 86_400_000;

/** أعمدة أفقية: تسمية، شريط، قيمة. */
function hbars(items, unit = "") {
  const max = Math.max(1, ...items.map((x) => x.value));
  return `<ul class="chart hbars" role="list">${items
    .map(
      (x) => `<li tabindex="0" aria-label="${esc(x.label)}: ${ar(x.value)} ${esc(unit)}">
        <span class="lbl">${esc(x.label)}</span>
        <span class="track"><span class="fill" style="inline-size:${(x.value / max) * 100}%"></span></span>
        <span class="val">${ar(x.value)}</span>
        <span class="tip" role="tooltip">${esc(x.label)}<b>${ar(x.value)} ${esc(unit)}</b></span>
      </li>`,
    )
    .join("")}</ul>`;
}

/** أعمدة رأسية (زمن أو فئات مرتّبة)، بتسميات محور مختارة. */
function vbars(items, unit = "", every = 1) {
  const max = Math.max(1, ...items.map((x) => x.value));
  return `<div class="chart vbars" role="list" style="--n:${items.length}">${items
    .map(
      (x, i) => `<div class="col" role="listitem" tabindex="0" aria-label="${esc(x.label)}: ${ar(x.value)} ${esc(unit)}">
        <span class="fill" style="block-size:${x.value ? Math.max(2, (x.value / max) * 100) : 0}%"></span>
        <span class="x">${i % every === 0 || i === items.length - 1 ? esc(x.short ?? x.label) : ""}</span>
        <span class="tip" role="tooltip">${esc(x.label)}<b>${ar(x.value)} ${esc(unit)}</b></span>
      </div>`,
    )
    .join("")}</div>`;
}

const table = (head, rows) => `<details class="chart-table"><summary>عرض البيانات جدولاً</summary>
  <table class="data-table"><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(String(c))}</td>`).join("")}</tr>`).join("")}</tbody></table></details>`;

const tile = (label, value, note = "") =>
  `<div class="stat-tile"><span class="muted small">${esc(label)}</span><b>${value}</b>${note ? `<span class="muted small">${esc(note)}</span>` : ""}</div>`;

export async function render(el) {
  el.innerHTML = spinner();
  const [courses, users] = await Promise.all([loadCourses(true), loadAllUsers()]);
  const rows = users.map((u) => summarize(u, courses));
  const live = courses.filter((c) => !c.comingSoon).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const now = Date.now();
  const n = rows.length;
  const active7 = rows.filter((r) => r.lastSeen && now - r.lastSeen.getTime() < 7 * DAY).length;
  const avg = n ? Math.round(rows.reduce((s, r) => s + r.progress, 0) / n) : 0;
  const passedTotal = rows.reduce((s, r) => s + r.skillsPassed, 0);
  const tasksTotal = rows.reduce((s, r) => s + r.tasksSubmitted, 0);
  const activeTotal = rows.reduce((s, r) => s + r.activeSeconds, 0);

  // توزيع نسب التقدّم
  const buckets = [
    ["لم يبدأ", (p) => p === 0],
    ["١–٢٥٪", (p) => p > 0 && p <= 25],
    ["٢٦–٥٠٪", (p) => p > 25 && p <= 50],
    ["٥١–٧٥٪", (p) => p > 50 && p <= 75],
    ["٧٦–٩٩٪", (p) => p > 75 && p < 100],
    ["أنهى كل الدروس", (p) => p === 100],
  ].map(([label, f]) => ({ label, value: rows.filter((r) => f(r.progress)).length }));

  // اجتياز كل مهارة، بترتيب المسار
  const skillPass = live.map((c) => ({
    label: `${c.number ?? c.order}. ${c.title}`,
    value: rows.filter((r) => r.passedIds.includes(c.id)).length,
  }));

  // المهام المرفوعة لكل مهارة (مفتاح المهمة يبدأ بمعرّف المهارة)
  const taskBySkill = live
    .map((c) => ({
      label: `${c.number ?? c.order}. ${c.title}`,
      value: users.reduce((s, u) => s + Object.keys(u.tasks || {}).filter((k) => k.startsWith(`${c.id}__`)).length, 0),
    }))
    .filter((x) => x.value > 0);

  // النشاط اليومي لآخر ٣٠ يوماً (دقائق)
  const days = Array.from({ length: 30 }, (_, i) => new Date(now - (29 - i) * DAY));
  const daily = days.map((d) => {
    const key = d.toISOString().slice(0, 10);
    const secs = rows.reduce((s, r) => s + (r.daily[key] || 0), 0);
    return {
      label: d.toLocaleDateString("ar-EG", { weekday: "short", day: "numeric", month: "short" }),
      short: d.toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" }),
      value: Math.round(secs / 60),
    };
  });

  const top = [...rows].sort((a, b) => b.progress - a.progress || b.activeSeconds - a.activeSeconds).slice(0, 10);

  el.innerHTML = `
    <a class="back" href="#/admin">→ لوحة التحكم</a>
    <div class="row wrap between">
      <h1 class="page-title">📊 تقارير المتدربين</h1>
      <span class="row"><a class="btn small" href="#/admin/users">👥 المستخدمون</a><button class="btn primary small" id="export">⬇️ تصدير Excel</button></span>
    </div>

    <section class="stat-row">
      ${tile("المتدربون", ar(n))}
      ${tile("نشطون آخر ٧ أيام", ar(active7), n ? `${ar(Math.round((active7 / n) * 100))}% منهم` : "")}
      ${tile("متوسط التقدّم", `${ar(avg)}%`, "من الدروس المنشورة")}
      ${tile("اجتيازات المهارات", ar(passedTotal))}
      ${tile("المهام المرفوعة", ar(tasksTotal))}
      ${tile("مجموع النشاط", duration(activeTotal))}
    </section>

    <section class="card">
      <h2>النشاط اليومي: دقائق الاستخدام في آخر ٣٠ يوماً</h2>
      ${daily.some((d) => d.value) ? vbars(daily, "دقيقة", 5) : `<p class="muted">لا نشاط مسجّل بعد. يبدأ القياس من آخر تحديث للمنصة.</p>`}
      ${table(["اليوم", "دقائق"], daily.map((d) => [d.label, d.value]))}
    </section>

    <div class="grid-2">
      <section class="card">
        <h2>توزيع التقدّم: عدد المتدربين في كل شريحة</h2>
        ${vbars(buckets, "متدرب")}
        ${table(["الشريحة", "المتدربون"], buckets.map((b) => [b.label, b.value]))}
      </section>
      <section class="card">
        <h2>المهارات المجتازة: عدد المتدربين لكل مهارة</h2>
        ${hbars(skillPass, "متدرب")}
        ${table(["المهارة", "اجتازها"], skillPass.map((s) => [s.label, s.value]))}
      </section>
    </div>

    <section class="card">
      <h2>المهام المرفوعة حسب المهارة</h2>
      ${taskBySkill.length ? hbars(taskBySkill, "مهمة") : `<p class="muted">لا مهام مرفوعة بعد. رفع المهام وتصحيحها الآلي يعملان بعد تفعيل خطة Blaze.</p>`}
      ${taskBySkill.length ? table(["المهارة", "المهام"], taskBySkill.map((s) => [s.label, s.value])) : ""}
    </section>

    <section class="card">
      <h2>الأعلى تقدّماً</h2>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>المتدرب</th><th>التقدّم</th><th>المهارات</th><th>مرات الفتح</th><th>النشاط</th></tr></thead>
        <tbody>${top
          .map(
            (r) => `<tr><td>${esc(r.name)}</td><td>${ar(r.progress)}%</td><td>${ar(r.skillsPassed)}/${ar(r.totalSkills)}</td><td>${ar(r.visits)}</td><td>${duration(r.activeSeconds)}</td></tr>`,
          )
          .join("") || `<tr><td colspan="5" class="muted">لا متدربين بعد.</td></tr>`}</tbody>
      </table></div>
    </section>`;

  el.querySelector("#export").addEventListener("click", () => exportUsers(rows, courses));
}
