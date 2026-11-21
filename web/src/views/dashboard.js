import { courseCompletion, dueReviews, levelProgress, mastery, recommendNext } from "../engine.js";
import { loadCourses, loadLeaderboard, loadSettings, skillLabels, skillStatuses, state } from "../store.js";
import { ar, esc, progressBar, spinner } from "../ui.js";

const REASON = {
  weak: "إتقانك لهذه المهارة منخفض؛ مراجعتها الآن ستثبّتها.",
  continue: "تابع من حيث توقفت.",
  start: "ابدأ رحلتك بهذا الدرس.",
};

export async function render(el) {
  el.innerHTML = spinner();
  const [allSkills, labels, settings] = await Promise.all([loadCourses(), skillLabels(), loadSettings()]);
  const statuses = skillStatuses(allSkills, state.progress, settings, state.isAdmin);
  // نوصي فقط بالمهارات المتاحة للمتدرب، ونعرض تقدّمه في المهارات ذات المحتوى
  const courses = allSkills.filter((c) => ["open", "passed"].includes(statuses.get(c.id)?.status));
  const visible = allSkills.filter((c) => !c.comingSoon);
  const p = state.progress;
  const lvl = levelProgress(p.xp);
  const due = dueReviews(p.review, Date.now()).length;
  const rec = recommendNext(courses, p);
  const mastered = Object.values(p.skills).filter((s) => mastery(s) >= 80).length;
  const skills = Object.entries(p.skills)
    .map(([id, s]) => ({ id, label: labels[id] || id, m: mastery(s), attempts: s.attempts }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 8);
  const firstName = (p.name || "").split(" ")[0];

  el.innerHTML = `
    <h1 class="page-title">أهلاً ${esc(firstName)} 👋</h1>
    <section class="stats" aria-label="إحصاءاتك">
      <div class="stat">
        <span class="stat-label">المستوى</span>
        <span class="stat-value">${ar(lvl.level)}</span>
        ${progressBar(lvl.pct, "التقدّم نحو المستوى التالي")}
        <span class="stat-note">${ar(p.xp)} / ${ar(lvl.next)} نقطة</span>
      </div>
      <div class="stat">
        <span class="stat-label">سلسلة الأيام</span>
        <span class="stat-value">${ar(p.streak || 0)} 🔥</span>
        <span class="stat-note">تعلّم يومياً لتطيل السلسلة</span>
      </div>
      <div class="stat">
        <span class="stat-label">مهارات متقنة</span>
        <span class="stat-value">${ar(mastered)}</span>
        <span class="stat-note">إتقان 80% فأكثر</span>
      </div>
      <a class="stat link-card" href="#/review">
        <span class="stat-label">مراجعات مستحقة</span>
        <span class="stat-value">${ar(due)}</span>
        <span class="stat-note">${due ? "ابدأ المراجعة الآن ←" : "لا شيء مستحق الآن"}</span>
      </a>
    </section>

    <div class="grid-2">
      <section class="card">
        <h2>الخطوة التالية المقترحة</h2>
        ${
          rec
            ? `<div class="rec">
                <span class="rec-icon" aria-hidden="true">${esc(rec.course.icon || "📘")}</span>
                <div>
                  <p class="muted">${esc(rec.course.title)}</p>
                  <h3>${esc(rec.lesson.title)}</h3>
                  <p>${REASON[rec.reason]}${rec.reason === "weak" ? ` (الإتقان الحالي ${ar(rec.mastery)}%)` : ""}</p>
                  <a class="btn primary" href="#/lesson/${esc(rec.course.id)}/${esc(rec.lesson.id)}">افتح الدرس</a>
                </div>
              </div>`
            : courses.length
              ? `<p>أتممت دروس المهارات المتاحة 🎉 اجتز <a href="#/courses">الاختبار البعدي</a> لتنتقل إلى المهارة التالية.</p>`
              : `<p class="muted">لا توجد مهارات بعد. ${state.isAdmin ? 'أنشئ دورة من <a href="#/admin">صفحة الإدارة</a>.' : "سيضيفها المشرف قريباً."}</p>`
        }
      </section>

      <section class="card">
        <h2>إتقان المهارات</h2>
        ${
          skills.length
            ? `<ul class="skills">${skills
                .map(
                  (s) => `<li><span>${esc(s.label)}</span>${progressBar(s.m, `إتقان ${s.label}`)}<b>${ar(s.m)}%</b></li>`,
                )
                .join("")}</ul>`
            : `<p class="muted">أجب عن أسئلة أي درس لنقيس مستواك في مهاراته.</p>`
        }
      </section>

      <section class="card">
        <h2>تقدّمك في المهارات</h2>
        <ul class="course-progress">${visible
          .map((c) => {
            const cc = courseCompletion(c, p);
            const s = statuses.get(c.id)?.status;
            const label = s === "passed" ? "✓ مجتازة" : s === "locked" ? "🔒" : `${ar(cc.done)}/${ar(cc.total)}`;
            return `<li><a href="#/course/${esc(c.id)}">${esc(c.icon || "📘")} ${esc(c.title)}</a>${progressBar(s === "passed" ? 100 : cc.pct, c.title)}<span>${label}</span></li>`;
          })
          .join("")}</ul>
      </section>

      <section class="card">
        <h2>لوحة الصدارة</h2>
        <div id="leaderboard">${spinner()}</div>
      </section>
    </div>`;

  loadLeaderboard()
    .then((rows) => {
      const box = el.querySelector("#leaderboard");
      if (!box) return;
      box.innerHTML = rows.length
        ? `<ol class="leaders">${rows
            .map(
              (r, i) => `<li class="${r.uid === state.user.uid ? "me" : ""}"><span class="rank">${ar(i + 1)}</span><span>${esc(
                r.name,
              )}</span><span class="muted">مستوى ${ar(r.level)}</span><b>${ar(r.xp)}</b></li>`,
            )
            .join("")}</ol>`
        : `<p class="muted">كن أول من يتصدّر!</p>`;
    })
    .catch(() => {
      const box = el.querySelector("#leaderboard");
      if (box) box.innerHTML = `<p class="muted">تعذّر تحميل لوحة الصدارة.</p>`;
    });
}
