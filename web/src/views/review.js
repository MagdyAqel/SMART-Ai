import { MAX_BOX, dueReviews } from "../engine.js";
import { state } from "../store.js";
import { ar, esc } from "../ui.js";
import { startReview } from "./quiz.js";

const SESSION_SIZE = 10;

export async function render(el) {
  const now = Date.now();
  const all = Object.entries(state.progress.review || {}).map(([key, e]) => ({ key, ...e }));
  const due = dueReviews(state.progress.review, now);
  const upcoming = all.filter((e) => e.due > now).sort((a, b) => a.due - b.due);
  const days = (t) => Math.max(1, Math.ceil((t - now) / 86400000));

  el.innerHTML = `
    <h1 class="page-title">المراجعة المتباعدة</h1>
    <p class="lead">الأسئلة التي أخطأت فيها تعود إليك على فترات تتباعد كلما أجبت صحيحاً، حتى تثبت في ذاكرتك. بعد ${ar(MAX_BOX)} إجابات صحيحة متتالية يتخرّج السؤال.</p>
    <section class="card">
      ${
        due.length
          ? `<h2>${ar(due.length)} أسئلة مستحقة الآن</h2>
             <button class="btn primary" id="start">ابدأ المراجعة (${ar(Math.min(SESSION_SIZE, due.length))} أسئلة)</button>`
          : `<h2>لا مراجعات مستحقة الآن ✅</h2><p class="muted">${
              upcoming.length ? `أقرب مراجعة بعد ${ar(days(upcoming[0].due))} يوم.` : "عندما تخطئ في سؤال سيظهر هنا للمراجعة."
            }</p>`
      }
    </section>
    ${
      upcoming.length
        ? `<section class="card"><h2>قادمة</h2><ul class="review-list">${upcoming
            .slice(0, 15)
            .map(
              (e) => `<li><span>${esc(e.q.q)}</span><span class="muted">بعد ${ar(days(e.due))} يوم · الصندوق ${ar(e.box)}/${ar(MAX_BOX)}</span></li>`,
            )
            .join("")}</ul></section>`
        : ""
    }`;
  el.querySelector("#start")?.addEventListener("click", () => startReview(due.slice(0, SESSION_SIZE)));
}
