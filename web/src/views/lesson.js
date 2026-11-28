import { FREE_PLAN } from "../firebase.js";
import { renderMedia } from "../media.js";
import { findLesson, loadCourses, loadSettings, skillStatuses, state, taskKey } from "../store.js";
import { ar, esc, go, spinner } from "../ui.js";
import { startLessonQuiz } from "./quiz.js";

export async function render(el, { courseId, lessonId }) {
  el.innerHTML = spinner();
  const { course, lesson } = await findLesson(courseId, lessonId);
  if (!lesson) {
    el.innerHTML = `<div class="card">لم نجد هذا الدرس. <a href="#/courses">عودة للدورات</a></div>`;
    return;
  }
  const st = skillStatuses(await loadCourses(), state.progress, await loadSettings(), state.isAdmin).get(course.id);
  if (st?.status === "locked" || st?.status === "soon") return go(`/course/${course.id}`);
  const idx = course.lessons.indexOf(lesson);
  const next = course.lessons[idx + 1];
  const tasks = lesson.tasks || [];
  const results = state.progress.tasks || {};
  el.innerHTML = `
    <a class="back" href="#/course/${esc(course.id)}">→ المهارة: ${esc(course.title)}</a>
    <article class="card lesson">
      <p class="muted">الدرس ${ar(idx + 1)} من ${ar(course.lessons.length)}</p>
      <h1>${esc(lesson.title)}</h1>
      ${(lesson.media || []).map(renderMedia).join("")}
      ${renderSteps(lesson.steps)}
      ${(lesson.content || []).map((para) => `<p>${esc(para)}</p>`).join("")}
    </article>
    <dialog class="shot-viewer" aria-label="عرض اللقطة مكبّرة">
      <button class="btn ghost small close" aria-label="إغلاق">✕</button>
      <img alt="" /><p class="cap"></p>
    </dialog>
    ${
      tasks.length
        ? `<section class="card">
            <h2>🛠️ مهام تطبيقية</h2>
            <p class="muted">طبّق ما تعلّمته، وسيصحّح المدرّب الذكي عملك فوراً وفق معايير واضحة.</p>
            <ul class="task-list">${tasks
              .map((t) => {
                const r = results[taskKey(course.id, lesson.id, t.id)];
                const status = r ? (r.passed ? `<span class="tag d1">✓ اجتزت · ${ar(r.best)}%</span>` : `<span class="tag d3">أفضل نتيجة ${ar(r.best)}%</span>`) : "";
                return `<li><div><b>${t.type === "prompt" ? "💬" : "📝"} ${esc(t.title)}</b> ${status}<p class="muted small">${
                  t.type === "prompt" ? "اختبار برومبت · سنشغّل برومبتك ونقيّم نتيجته" : "مهمة كتابية"
                }</p></div><a class="btn ${r?.passed ? "" : "primary"} small" href="#/task/${esc(course.id)}/${esc(lesson.id)}/${esc(t.id)}">${
                  r ? "حاول مجدداً" : "ابدأ المهمة"
                }</a></li>`;
              })
              .join("")}</ul>
          </section>`
        : ""
    }
    <div class="actions">
      ${lesson.questions?.length ? `<button class="btn primary" id="quiz">🎯 ابدأ الاختبار التكيّفي</button>` : ""}
      ${FREE_PLAN ? "" : `<button class="btn" id="ask">🤖 اسأل المدرّب عن هذا الدرس</button>`}
      ${next ? `<a class="btn ghost" href="#/lesson/${esc(course.id)}/${esc(next.id)}">الدرس التالي ←</a>` : ""}
    </div>`;
  // تكبير لقطة الخطوة: نافذة بالحجم الكامل، وتُغلق بالضغط أو بزر Esc
  const viewer = el.querySelector(".shot-viewer");
  el.querySelectorAll(".step-shot").forEach((b) =>
    b.addEventListener("click", () => {
      viewer.querySelector("img").src = b.dataset.src;
      viewer.querySelector("img").alt = b.dataset.caption;
      viewer.querySelector(".cap").textContent = b.dataset.caption;
      viewer.showModal();
    }),
  );
  viewer.addEventListener("click", () => viewer.close());
  el.querySelector("#quiz")?.addEventListener("click", () => startLessonQuiz(course, lesson));
  el.querySelector("#ask")?.addEventListener("click", () => {
    state.tutorPrefill = null;
    go(`/tutor?course=${encodeURIComponent(course.id)}&lesson=${encodeURIComponent(lesson.id)}`);
  });
}

/** خطوات العمل بلقطات حقيقية من الأداة نفسها، مرقّمة، وتُكبَّر بالضغط. */
export function renderSteps(steps) {
  const list = (steps || []).filter((s) => /^\/(?!\/)/.test(String(s.url || "")));
  if (!list.length) return "";
  return `<section class="steps-gallery" aria-label="خطوات العمل بالصور">
    <h2>🖼️ الخطوات بلقطات حقيقية من الأداة</h2>
    <p class="muted small">اضغط أي لقطة لتكبيرها.</p>
    <ol>${list
      .map(
        (s, i) => `<li>
          <button class="step-shot" data-src="${esc(s.url)}" data-caption="${esc(s.caption || "")}" aria-label="تكبير: ${esc(s.caption || "")}">
            <img src="${esc(s.url)}" alt="${esc(s.caption || "")}" loading="lazy" decoding="async"
              ${s.width && s.height ? `width="${Number(s.width)}" height="${Number(s.height)}"` : ""} />
          </button>
          <p><b class="step-num">${ar(i + 1)}</b> ${esc(s.caption || "")}</p>
        </li>`,
      )
      .join("")}</ol>
  </section>`;
}
