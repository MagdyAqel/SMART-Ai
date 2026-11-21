import { loadSubmission, loadSubmissions } from "../store.js";
import { ar, esc, progressBar, spinner } from "../ui.js";
import { bindCopy, gradeResultHtml } from "./grade-result.js";

const fmtDate = (ts) => (ts?.toDate ? ts.toDate().toLocaleDateString("ar", { day: "numeric", month: "short" }) : "");

/** تقرير الأداء: ملخص التسليمات، ومتوسط كل معيار، وتطوّر الدرجات. */
export async function render(el, _params, query) {
  const one = query.get("id");
  if (one) return renderOne(el, one);

  el.innerHTML = spinner();
  const subs = await loadSubmissions(100);
  if (!subs.length) {
    el.innerHTML = `<h1 class="page-title">📈 أدائي</h1>
      <div class="card"><p>لم تسلّم أي مهمة بعد. افتح درساً وابدأ أول مهمة تطبيقية، وسيظهر تقرير أدائك هنا.</p>
      <a class="btn primary" href="#/courses">الدورات</a></div>`;
    return;
  }

  const avg = Math.round(subs.reduce((s, x) => s + x.pct, 0) / subs.length);
  const tasks = new Map();
  for (const s of subs) {
    const k = `${s.courseId}/${s.lessonId}/${s.taskId}`;
    const t = tasks.get(k) ?? { title: s.taskTitle, first: s.pct, best: s.pct, passed: false, n: 0 };
    t.first = s.pct; // القائمة مرتبة من الأحدث، فآخر قيمة تُقرأ هي الأقدم
    t.best = Math.max(t.best, s.pct);
    t.passed ||= s.passed;
    t.n += 1;
    tasks.set(k, t);
  }
  const passedCount = [...tasks.values()].filter((t) => t.passed).length;

  // متوسط النسبة في كل معيار (تجميع حسب اسم المعيار عبر المهام)
  const crit = new Map();
  for (const s of subs) {
    for (const c of s.criteria) {
      const v = crit.get(c.criterion) ?? { sum: 0, n: 0 };
      v.sum += c.score / c.points;
      v.n += 1;
      crit.set(c.criterion, v);
    }
  }
  const critRows = [...crit.entries()].map(([name, v]) => ({ name, pct: Math.round((v.sum / v.n) * 100), n: v.n })).sort((a, b) => a.pct - b.pct);
  const weakest = critRows.filter((c) => c.pct < 70).slice(0, 3);
  const recent = subs.slice(0, 10).reverse();

  el.innerHTML = `
    <h1 class="page-title">📈 أدائي</h1>
    <section class="stats">
      <div class="stat"><span class="stat-label">التسليمات</span><span class="stat-value">${ar(subs.length)}</span></div>
      <div class="stat"><span class="stat-label">متوسط الدرجات</span><span class="stat-value">${ar(avg)}%</span></div>
      <div class="stat"><span class="stat-label">مهام مجتازة</span><span class="stat-value">${ar(passedCount)} / ${ar(tasks.size)}</span></div>
    </section>
    <div class="grid-2">
      <section class="card">
        <h2>آخر الدرجات</h2>
        <div class="spark" role="img" aria-label="آخر ${ar(recent.length)} درجات">${recent
          .map((s) => `<span style="height:${Math.max(4, s.pct)}%" class="${s.passed ? "ok" : ""}" title="${esc(s.taskTitle)}: ${s.pct}%"></span>`)
          .join("")}</div>
      </section>
      <section class="card">
        <h2>ركّز على</h2>
        ${
          weakest.length
            ? `<ul>${weakest.map((c) => `<li><b>${esc(c.name)}</b> — متوسطك ${ar(c.pct)}%</li>`).join("")}</ul>`
            : `<p>أداؤك فوق 70% في جميع المعايير 🎉</p>`
        }
      </section>
    </div>
    <section class="card">
      <h2>الأداء حسب المعيار</h2>
      <ul class="skills">${critRows
        .map((c) => `<li><span>${esc(c.name)}</span>${progressBar(c.pct, c.name)}<b>${ar(c.pct)}%</b></li>`)
        .join("")}</ul>
    </section>
    <section class="card">
      <h2>التقدّم في المهام</h2>
      <ul class="review-list">${[...tasks.values()]
        .map((t) => `<li><span>${esc(t.title)}</span><span class="muted">${ar(t.n)} محاولات · من ${ar(t.first)}% إلى ${ar(t.best)}% ${t.passed ? "✓" : ""}</span></li>`)
        .join("")}</ul>
    </section>
    <section class="card">
      <h2>كل التسليمات</h2>
      <ul class="review-list">${subs
        .map(
          (s) => `<li><a href="#/performance?id=${esc(s.id)}">${esc(s.taskTitle)}</a><span class="muted">${fmtDate(s.createdAt)} · ${ar(s.pct)}% ${
            s.passed ? "✓" : ""
          }</span></li>`,
        )
        .join("")}</ul>
    </section>`;
}

async function renderOne(el, id) {
  el.innerHTML = spinner();
  const s = await loadSubmission(id);
  if (!s) {
    el.innerHTML = `<div class="card">لم نجد هذا التسليم. <a href="#/performance">عودة</a></div>`;
    return;
  }
  el.innerHTML = `
    <a class="back" href="#/performance">→ أدائي</a>
    <section class="card">
      <p class="muted">${esc(s.lessonTitle || "")} · ${fmtDate(s.createdAt)}</p>
      <h1>${esc(s.taskTitle)}</h1>
      <h3>${s.type === "prompt" ? "برومبتك" : "إجابتك"}</h3>
      <pre class="answer">${esc(s.answer)}</pre>
      <a class="btn small" href="#/task/${esc(s.courseId)}/${esc(s.lessonId)}/${esc(s.taskId)}">حاول مجدداً</a>
    </section>
    ${gradeResultHtml(s)}`;
  bindCopy(el, s.improved);
}
