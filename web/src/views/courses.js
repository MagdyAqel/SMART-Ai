// خريطة المهارات: كل المهارات ظاهرة دائماً، والانتقال يكون بعد اجتياز الاختبار البعدي للسابقة.
import { loadCourses, loadSettings, skillPassScore, skillStatuses, state } from "../store.js";
import { ar, esc, progressBar, spinner } from "../ui.js";

const LABEL = {
  passed: "مكتملة",
  open: "متاحة",
  locked: "مقفلة",
  soon: "قريباً",
};
const ICON = { passed: "✓", open: "▶", locked: "🔒", soon: "⏳" };

export async function render(el) {
  el.innerHTML = spinner();
  const [skills, settings] = await Promise.all([loadCourses(true), loadSettings()]);
  const statuses = skillStatuses(skills, state.progress, settings, state.isAdmin);
  const ordered = [...skills].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const active = ordered.filter((s) => !s.comingSoon);
  const passed = active.filter((s) => statuses.get(s.id).status === "passed").length;

  el.innerHTML = `
    <header class="skills-head">
      <div>
        <h1 class="page-title">مهارات البرنامج</h1>
        <p class="lead">تنتقل إلى المهارة التالية عندما تجتاز الاختبار البعدي للمهارة الحالية بنسبة ${ar(settings.passScore)}% أو أكثر.</p>
      </div>
      <div class="overall">
        <span class="muted small">إنجازك في البرنامج</span>
        <b>${ar(passed)} من ${ar(ordered.length)} مهارات</b>
        ${progressBar((passed / Math.max(1, ordered.length)) * 100, "إنجازك في البرنامج")}
      </div>
    </header>
    <ol class="skill-map">${ordered
      .map((s) => {
        const st = statuses.get(s.id);
        const clickable = st.status === "passed" || st.status === "open";
        const tag = clickable ? "a" : "div";
        const href = clickable ? `href="#/course/${esc(s.id)}"` : "";
        const note =
          st.status === "locked"
            ? `اجتز اختبار «${esc(st.requires?.title || "المهارة السابقة")}» بنسبة ${ar(skillPassScore(st.requires, settings))}% لفتحها`
            : st.status === "soon"
              ? "يُضاف محتواها قريباً"
              : st.status === "passed"
                ? `أفضل نتيجة ${ar(st.result.best)}%`
                : st.result
                  ? `محاولاتك: ${ar(st.result.attempts)} · أفضل نتيجة ${ar(st.result.best)}%`
                  : `${ar(s.lessons?.length || 0)} دروس · ${ar(s.intro?.minutes || 0)} دقيقة`;
        return `<li class="skill-node ${st.status}">
          <${tag} class="skill-card" ${href} ${clickable ? "" : 'aria-disabled="true"'}>
            <span class="skill-num" aria-hidden="true">${st.status === "passed" ? "✓" : ar(s.number ?? s.order)}</span>
            <span class="skill-icon" aria-hidden="true">${esc(s.icon || "📘")}</span>
            <span class="skill-body">
              <span class="skill-kicker">المهارة ${ar(s.number ?? s.order)}</span>
              <span class="skill-title">${esc(s.title)}</span>
              <span class="skill-desc">${esc(s.description || "")}</span>
              <span class="skill-note">${note}</span>
            </span>
            <span class="skill-status"><span aria-hidden="true">${ICON[st.status]}</span> ${LABEL[st.status]}</span>
          </${tag}>
        </li>`;
      })
      .join("")}</ol>`;
}
