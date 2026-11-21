import { courseCompletion } from "../engine.js";
import { loadCourses, state } from "../store.js";
import { ar, esc, progressBar, spinner } from "../ui.js";

export async function render(el) {
  el.innerHTML = spinner();
  const courses = await loadCourses(true);
  el.innerHTML = `
    <h1 class="page-title">الدورات</h1>
    ${
      courses.length
        ? `<div class="course-grid">${courses
            .map((c) => {
              const cc = courseCompletion(c, state.progress);
              const minutes = c.lessons.reduce((s, l) => s + (l.minutes || 0), 0);
              return `<a class="card course-card" href="#/course/${esc(c.id)}">
                <span class="course-icon" aria-hidden="true">${esc(c.icon || "📘")}</span>
                <h2>${esc(c.title)}</h2>
                <p>${esc(c.description)}</p>
                <div class="meta"><span>${esc(c.level || "")}</span><span>${ar(c.lessons.length)} دروس</span><span>${ar(minutes)} دقيقة</span>${
                  c.generated ? '<span class="tag">✨ مولّدة</span>' : ""
                }</div>
                ${progressBar(cc.pct, `إكمال ${c.title}`)}
              </a>`;
            })
            .join("")}</div>`
        : `<div class="card"><p class="muted">لا توجد دورات منشورة بعد.</p></div>`
    }`;
}
