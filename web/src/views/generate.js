import { callGenerateQuiz } from "../firebase.js";
import { loadMyQuizzes } from "../store.js";
import { ar, errorMessage, esc, spinner, toast } from "../ui.js";
import { startGeneratedQuiz } from "./quiz.js";

export async function render(el) {
  let quizzes = [];
  el.innerHTML = `
    <h1 class="page-title">✨ الاختبار الذكي</h1>
    <p class="lead">اكتب أي موضوع تريد التدرّب عليه، أو الصق نصاً (ملخص محاضرة، سياسة عمل، فصل من كتاب) ليبني لك المدرّب اختباراً منه.</p>
    <form class="card form" id="gen">
      <label class="field">الموضوع
        <input name="topic" maxlength="200" placeholder="مثال: أساسيات إدارة الوقت، الكسور العشرية، قواعد SQL" />
      </label>
      <label class="field">نص مرجعي (اختياري)
        <textarea name="sourceText" rows="6" maxlength="12000" placeholder="الصق هنا نصاً تريد أن تكون الأسئلة مبنية عليه"></textarea>
      </label>
      <div class="row wrap">
        <label class="field">الصعوبة
          <select name="difficulty">
            <option value="mixed">متدرجة</option>
            <option value="1">سهلة</option>
            <option value="2">متوسطة</option>
            <option value="3">متقدمة</option>
          </select>
        </label>
        <label class="field">عدد الأسئلة
          <select name="count">${[3, 5, 7, 10].map((n) => `<option value="${n}" ${n === 5 ? "selected" : ""}>${ar(n)}</option>`).join("")}</select>
        </label>
      </div>
      <p class="form-error" role="alert"></p>
      <button class="btn primary" type="submit">ولّد الاختبار</button>
    </form>
    <section class="card">
      <h2>اختباراتي السابقة</h2>
      <div id="mine">${spinner()}</div>
    </section>`;

  const form = el.querySelector("#gen");
  const errorEl = form.querySelector(".form-error");
  const mine = el.querySelector("#mine");

  const drawMine = () => {
    mine.innerHTML = quizzes.length
      ? `<ul class="quiz-list">${quizzes
          .map(
            (q, i) => `<li><div><b>${esc(q.title)}</b><span class="muted"> · ${ar(q.questions.length)} أسئلة${
              q.fromSource ? " · من نص مرجعي" : ""
            }</span></div><button class="btn small" data-i="${i}">ابدأ</button></li>`,
          )
          .join("")}</ul>`
      : `<p class="muted">لم تولّد أي اختبار بعد.</p>`;
  };

  loadMyQuizzes()
    .then((list) => {
      quizzes = list;
      drawMine();
    })
    .catch(() => (mine.innerHTML = `<p class="muted">تعذّر تحميل اختباراتك.</p>`));

  mine.addEventListener("click", (e) => {
    const b = e.target.closest("[data-i]");
    if (b) startGeneratedQuiz(quizzes[Number(b.dataset.i)]);
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const data = {
      topic: form.topic.value.trim(),
      sourceText: form.sourceText.value.trim(),
      difficulty: form.difficulty.value === "mixed" ? "mixed" : Number(form.difficulty.value),
      count: Number(form.count.value),
    };
    if (data.topic.length < 2 && data.sourceText.length < 50) {
      errorEl.textContent = "اكتب موضوعاً، أو الصق نصاً لا يقل عن 50 حرفاً.";
      return;
    }
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    btn.innerHTML = `<span class="spin" aria-hidden="true"></span> يكتب المدرّب الأسئلة…`;
    try {
      const { data: quiz } = await callGenerateQuiz(data);
      toast(`جاهز: ${quiz.title}`, "success");
      startGeneratedQuiz(quiz);
    } catch (err) {
      errorEl.textContent = errorMessage(err);
    } finally {
      if (btn.isConnected) {
        btn.disabled = false;
        btn.textContent = "ولّد الاختبار";
      }
    }
  });
}
