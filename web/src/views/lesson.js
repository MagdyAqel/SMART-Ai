import { findLesson, state } from "../store.js";
import { esc, go, spinner } from "../ui.js";
import { startLessonQuiz } from "./quiz.js";

export async function render(el, { courseId, lessonId }) {
  el.innerHTML = spinner();
  const { course, lesson } = await findLesson(courseId, lessonId);
  if (!lesson) {
    el.innerHTML = `<div class="card">لم نجد هذا الدرس. <a href="#/courses">عودة للدورات</a></div>`;
    return;
  }
  const idx = course.lessons.indexOf(lesson);
  const next = course.lessons[idx + 1];
  el.innerHTML = `
    <a class="back" href="#/course/${esc(course.id)}">→ ${esc(course.title)}</a>
    <article class="card lesson">
      <p class="muted">الدرس ${idx + 1} من ${course.lessons.length}</p>
      <h1>${esc(lesson.title)}</h1>
      ${lesson.content.map((para) => `<p>${esc(para)}</p>`).join("")}
    </article>
    <div class="actions">
      <button class="btn primary" id="quiz">🎯 ابدأ الاختبار التكيّفي</button>
      <button class="btn" id="ask">🤖 اسأل المدرّب عن هذا الدرس</button>
      ${next ? `<a class="btn ghost" href="#/lesson/${esc(course.id)}/${esc(next.id)}">الدرس التالي ←</a>` : ""}
    </div>`;
  el.querySelector("#quiz").addEventListener("click", () => startLessonQuiz(course, lesson));
  el.querySelector("#ask").addEventListener("click", () => {
    state.tutorPrefill = null;
    go(`/tutor?course=${encodeURIComponent(course.id)}&lesson=${encodeURIComponent(lesson.id)}`);
  });
}
