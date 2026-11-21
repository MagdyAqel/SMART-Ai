import { courseCompletion, lessonKey, mastery } from "../engine.js";
import { loadCourses, state } from "../store.js";
import { ar, esc, progressBar, spinner } from "../ui.js";

export async function render(el, { courseId }) {
  el.innerHTML = spinner();
  const course = (await loadCourses()).find((c) => c.id === courseId);
  if (!course) {
    el.innerHTML = `<div class="card">لم نجد هذه الدورة. <a href="#/courses">عودة للدورات</a></div>`;
    return;
  }
  const p = state.progress;
  const cc = courseCompletion(course, p);
  el.innerHTML = `
    <a class="back" href="#/courses">→ الدورات</a>
    <header class="course-head">
      <span class="course-icon big" aria-hidden="true">${esc(course.icon || "📘")}</span>
      <div>
        <h1 class="page-title">${esc(course.title)}</h1>
        <p>${esc(course.description)}</p>
        <div class="row">${progressBar(cc.pct, "إكمال الدورة")}<span>${ar(cc.done)} من ${ar(cc.total)} دروس</span></div>
      </div>
    </header>
    <ol class="lessons">${course.lessons
      .map((l, i) => {
        const done = p.completed[lessonKey(course.id, l.id)];
        const skill = p.skills[l.skill];
        return `<li class="card lesson-row ${done ? "done" : ""}">
          <span class="num" aria-hidden="true">${done ? "✓" : ar(i + 1)}</span>
          <div class="grow">
            <h2><a href="#/lesson/${esc(course.id)}/${esc(l.id)}">${esc(l.title)}</a></h2>
            <p class="muted">${ar(l.minutes || 5)} دقائق · ${ar(l.questions.length)} أسئلة${
              done ? ` · أفضل نتيجة ${ar(done.best)}%` : ""
            }${skill?.attempts ? ` · إتقان ${ar(mastery(skill))}%` : ""}</p>
          </div>
          <a class="btn ${done ? "" : "primary"}" href="#/lesson/${esc(course.id)}/${esc(l.id)}">${done ? "مراجعة" : "ابدأ"}</a>
        </li>`;
      })
      .join("")}</ol>`;
}
