import { callGradeSubmission } from "../firebase.js";
import { findLesson, saveProgress, state, taskKey } from "../store.js";
import { ar, errorMessage, esc, spinner, toast } from "../ui.js";
import { bindCopy, gradeResultHtml } from "./grade-result.js";

const TASK_XP = 30;
const drafts = new Map(); // مسودات المتدرب طوال الجلسة

export async function render(el, { courseId, lessonId, taskId }) {
  el.innerHTML = spinner();
  const { course, lesson } = await findLesson(courseId, lessonId);
  const task = lesson?.tasks?.find((t) => t.id === taskId);
  if (!task) {
    el.innerHTML = `<div class="card">لم نجد هذه المهمة. <a href="#/courses">عودة للدورات</a></div>`;
    return;
  }
  const key = taskKey(courseId, lessonId, taskId);
  const prev = state.progress.tasks?.[key];
  const isPrompt = task.type === "prompt";

  el.innerHTML = `
    <a class="back" href="#/lesson/${esc(courseId)}/${esc(lessonId)}">→ ${esc(lesson.title)}</a>
    <section class="card">
      <p class="muted">${isPrompt ? "💬 اختبار برومبت" : "📝 مهمة كتابية"} · ${esc(course.title)}</p>
      <h1>${esc(task.title)}</h1>
      <p>${esc(task.instructions).replace(/\n/g, "<br>")}</p>
      ${task.material ? `<details class="material" open><summary>المادة المرفقة</summary><p>${esc(task.material).replace(/\n/g, "<br>")}</p></details>` : ""}
      <details class="rubric"><summary>معايير التقييم (${ar(task.rubric.length)}) · النجاح من ${ar(task.passScore || 70)}%</summary>
        <ul>${task.rubric.map((c) => `<li><b>${esc(c.criterion)}</b> — ${ar(c.points)} درجة${c.description ? `<br><span class="muted">${esc(c.description)}</span>` : ""}</li>`).join("")}</ul>
      </details>
      ${prev ? `<p class="muted">محاولاتك: ${ar(prev.attempts)} · أفضل نتيجة ${ar(prev.best)}%${prev.passed ? " · ✓ اجتزت" : ""}</p>` : ""}
    </section>
    <form class="card" id="submit-form">
      <label class="field">${isPrompt ? "اكتب برومبتك" : "إجابتك"}
        <textarea name="answer" rows="${isPrompt ? 8 : 12}" maxlength="8000" required placeholder="${
          isPrompt ? "أنت معلم... اكتب..." : "اكتب إجابتك هنا"
        }"></textarea>
      </label>
      <div class="row wrap"><span class="muted small" id="count"></span></div>
      <p class="form-error" role="alert"></p>
      <button class="btn primary" type="submit">${isPrompt ? "شغّل البرومبت وصحّحه" : "صحّح إجابتي"}</button>
    </form>
    <div id="result"></div>`;

  const form = el.querySelector("#submit-form");
  const area = form.answer;
  const count = el.querySelector("#count");
  const errorEl = form.querySelector(".form-error");
  const result = el.querySelector("#result");
  area.value = drafts.get(key) || "";
  const updateCount = () => {
    drafts.set(key, area.value);
    const words = area.value.trim() ? area.value.trim().split(/\s+/).length : 0;
    count.textContent = `${ar(words)} كلمة · ${ar(area.value.length)} / ${ar(8000)} حرف`;
  };
  area.addEventListener("input", updateCount);
  updateCount();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const answer = area.value.trim();
    if (answer.length < 20) {
      errorEl.textContent = "الإجابة قصيرة جداً، اكتب 20 حرفاً على الأقل.";
      return;
    }
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    btn.innerHTML = `<span class="spin" aria-hidden="true"></span> ${isPrompt ? "نشغّل برومبتك ثم نصحّحه…" : "نصحّح إجابتك…"}`;
    result.innerHTML = "";
    try {
      const { data } = await callGradeSubmission({ courseId, lessonId, taskId, answer });
      // نحدّث نسخة التقدّم المحلية بنتيجة الخادم، ونمنح نقاط أول نجاح.
      const tasks = { ...(state.progress.tasks || {}) };
      const old = tasks[key];
      tasks[key] = {
        best: Math.max(old?.best ?? 0, data.pct),
        passed: Boolean(old?.passed) || data.passed,
        attempts: (old?.attempts ?? 0) + 1,
        lastAt: Date.now(),
      };
      saveProgress({ ...state.progress, tasks, xp: state.progress.xp + (data.firstPass ? TASK_XP : 0) });
      if (data.firstPass) toast(`أحسنت! اجتزت المهمة +${ar(TASK_XP)} نقطة`, "success");
      result.innerHTML = gradeResultHtml(data);
      bindCopy(result, data.improved);
      result.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      errorEl.textContent = errorMessage(err);
    } finally {
      if (btn.isConnected) {
        btn.disabled = false;
        btn.textContent = isPrompt ? "شغّل البرومبت وصحّحه" : "صحّح إجابتي";
      }
    }
  });
}
