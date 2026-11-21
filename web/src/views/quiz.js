import { applyAnswer, completeLesson, lessonKey, mastery, pickNextQuestion, skillRating } from "../engine.js";
import { logAttempt, saveProgress, state } from "../store.js";
import { ar, esc, go, progressBar } from "../ui.js";

const LESSON_QUIZ_LENGTH = 4;
const LETTERS = ["أ", "ب", "ج", "د", "هـ", "و"];

function snapshot(q, source) {
  return { q: q.q, options: q.options, answer: q.answer, explanation: q.explanation || "", difficulty: q.difficulty, source };
}

function begin(session) {
  state.quiz = { asked: [], answers: [], xp: 0, current: null, feedback: null, finished: false, ...session };
  go("/quiz");
  // إن كنا أصلاً على صفحة الاختبار فلن ينطلق hashchange
  if (location.hash === "#/quiz") window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function startLessonQuiz(course, lesson) {
  begin({
    mode: "lesson",
    title: lesson.title,
    backHref: `/lesson/${course.id}/${lesson.id}`,
    courseId: course.id,
    lessonId: lesson.id,
    adaptive: true,
    pool: lesson.questions,
    length: Math.min(LESSON_QUIZ_LENGTH, lesson.questions.length),
    skillOf: () => lesson.skill,
    keyOf: (q) => `${lessonKey(course.id, lesson.id)}__${q.id}`,
    sourceOf: () => `${course.title} — ${lesson.title}`,
  });
}

export function startGeneratedQuiz(quiz) {
  begin({
    mode: "generated",
    title: quiz.title,
    backHref: "/generate",
    quizId: quiz.id,
    adaptive: true,
    pool: quiz.questions,
    length: quiz.questions.length,
    skillOf: () => "generated",
    keyOf: (q) => `gen__${quiz.id}__${q.id}`,
    sourceOf: () => quiz.title,
  });
}

export function startReview(items) {
  begin({
    mode: "review",
    title: "المراجعة المتباعدة",
    backHref: "/review",
    adaptive: false,
    pool: items.map((it) => ({ ...it.q, id: it.key, skill: it.skill })),
    length: items.length,
    skillOf: (q) => q.skill,
    keyOf: (q) => q.id,
    sourceOf: (q) => q.source,
  });
}

function nextQuestion(s) {
  if (s.answers.length >= s.length) return null;
  if (!s.adaptive) return s.pool[s.answers.length] ?? null;
  const skill = s.skillOf(s.pool[0]);
  return pickNextQuestion(s.pool, skillRating(state.progress, skill), new Set(s.asked));
}

export async function render(el) {
  const s = state.quiz;
  if (!s) {
    go("/");
    return;
  }
  if (!s.current && !s.finished) {
    s.current = nextQuestion(s);
    if (s.current) s.asked.push(s.current.id);
    else s.finished = true;
  }

  const draw = () => (s.finished ? drawSummary(el, s) : drawQuestion(el, s));
  draw();

  const answer = (choice) => {
    if (s.feedback || s.finished) return;
    const q = s.current;
    const correct = choice === q.answer;
    const skill = s.skillOf(q);
    const result = applyAnswer(state.progress, {
      skill,
      question: q,
      correct,
      now: Date.now(),
      reviewKey: s.keyOf(q),
      snapshot: snapshot(q, s.sourceOf(q)),
    });
    saveProgress(result.progress);
    s.xp += result.xpGained;
    s.answers.push({ q, choice, correct });
    s.feedback = { choice, correct, xp: result.xpGained, masteryAfter: result.masteryAfter };
    draw();
  };

  const advance = () => {
    if (!s.feedback) return;
    s.feedback = null;
    s.current = nextQuestion(s);
    if (s.current) s.asked.push(s.current.id);
    else finish(s);
    draw();
  };

  const onClick = (e) => {
    const opt = e.target.closest("[data-choice]");
    if (opt) return answer(Number(opt.dataset.choice));
    if (e.target.closest("#next")) return advance();
    if (e.target.closest("#why")) return askTutor(s);
    if (e.target.closest("#retry")) {
      if (s.mode === "review") return go("/review");
      return begin({ ...s, asked: [], answers: [], xp: 0, current: null, feedback: null, finished: false, bonus: 0, passed: false });
    }
  };
  const onKey = (e) => {
    if (e.target.matches("input, textarea")) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 6 && !s.feedback) answer(n - 1);
    else if (e.key === "Enter" && s.feedback) advance();
  };
  el.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  return () => {
    el.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
  };
}

function finish(s) {
  s.finished = true;
  const score = s.answers.filter((a) => a.correct).length;
  const total = s.answers.length;
  if (s.mode === "lesson") {
    const r = completeLesson(state.progress, { courseId: s.courseId, lessonId: s.lessonId, score, total, now: Date.now() });
    s.passed = r.passed;
    s.bonus = r.bonus;
    if (r.progress !== state.progress) saveProgress(r.progress);
  }
  logAttempt({
    mode: s.mode,
    title: s.title,
    courseId: s.courseId ?? null,
    lessonId: s.lessonId ?? null,
    quizId: s.quizId ?? null,
    score,
    total,
    xp: s.xp + (s.bonus || 0),
  });
}

function askTutor(s) {
  const last = s.answers.at(-1);
  if (!last) return;
  const { q, choice } = last;
  state.tutorPrefill = `في هذا السؤال: «${q.q}»\nاخترتُ: «${q.options[choice]}»، والإجابة الصحيحة: «${q.options[q.answer]}».\nاشرح لي الفكرة بطريقة مختلفة ولماذا كانت إجابتي ${last.correct ? "صحيحة" : "خاطئة"}.`;
  const ctx = s.mode === "lesson" ? `?course=${encodeURIComponent(s.courseId)}&lesson=${encodeURIComponent(s.lessonId)}` : "";
  go(`/tutor${ctx}`);
}

function drawQuestion(el, s) {
  const q = s.current;
  const f = s.feedback;
  const n = s.answers.length + (f ? 0 : 1);
  const diff = ["", "سهل", "متوسط", "متقدم"][q.difficulty] || "";
  el.innerHTML = `
    <a class="back" href="#${esc(s.backHref)}">→ إنهاء الاختبار</a>
    <section class="card quiz">
      <div class="quiz-head">
        <span>${esc(s.title)}</span>
        <span class="muted">السؤال ${ar(Math.min(n, s.length))} من ${ar(s.length)} · <span class="tag d${q.difficulty}">${diff}</span></span>
      </div>
      ${progressBar((s.answers.length / s.length) * 100, "التقدّم في الاختبار")}
      <h1 class="question">${esc(q.q)}</h1>
      <div class="options" role="group" aria-label="الخيارات">
        ${q.options
          .map((o, i) => {
            let cls = "";
            if (f) cls = i === q.answer ? "correct" : i === f.choice ? "wrong" : "dim";
            return `<button class="option ${cls}" data-choice="${i}" ${f ? "disabled" : ""}><span class="letter">${LETTERS[i]}</span><span>${esc(o)}</span></button>`;
          })
          .join("")}
      </div>
      ${
        f
          ? `<div class="feedback ${f.correct ? "ok" : "bad"}" role="status">
              <strong>${f.correct ? `أحسنت! +${ar(f.xp)} نقطة` : "ليست الإجابة الصحيحة"}</strong>
              ${q.explanation ? `<p>${esc(q.explanation)}</p>` : ""}
              <p class="muted">إتقانك لهذه المهارة الآن: ${ar(f.masteryAfter)}%${f.correct ? "" : " · أضفنا السؤال إلى مراجعتك"}</p>
            </div>
            <div class="actions">
              <button class="btn primary" id="next">${s.answers.length >= s.length ? "عرض النتيجة" : "السؤال التالي ←"}</button>
              <button class="btn" id="why">🤖 اشرح لي أكثر</button>
            </div>`
          : `<p class="hint muted">تلميح: استخدم الأرقام ١–${ar(q.options.length)} في لوحة المفاتيح للإجابة.</p>`
      }
    </section>`;
  if (f) el.querySelector("#next")?.focus();
}

function drawSummary(el, s) {
  const score = s.answers.filter((a) => a.correct).length;
  const total = s.answers.length;
  const pct = total ? Math.round((score / total) * 100) : 0;
  const wrong = s.answers.filter((a) => !a.correct);
  const skill = s.mode === "review" ? null : state.progress.skills[s.skillOf(s.pool[0])];
  let headline = pct >= 80 ? "عمل رائع! 🌟" : pct >= 60 ? "أداء جيد 👍" : "استمر في المحاولة 💪";
  if (total === 0) headline = "لا توجد أسئلة";
  el.innerHTML = `
    <section class="card summary">
      <h1>${headline}</h1>
      <div class="score-ring" style="--p:${pct}"><span>${ar(pct)}%</span></div>
      <p>${ar(score)} إجابات صحيحة من ${ar(total)} · <b>+${ar(s.xp + (s.bonus || 0))} نقطة</b></p>
      ${s.mode === "lesson" ? `<p>${s.passed ? `✅ اجتزت الدرس${s.bonus ? ` (+${ar(s.bonus)} مكافأة أول إتمام)` : ""}` : "تحتاج 60% لاجتياز الدرس، راجع المحتوى وحاول مجدداً."}</p>` : ""}
      ${skill ? `<p class="muted">إتقان المهارة: ${ar(mastery(skill))}%</p>` : ""}
      ${
        wrong.length
          ? `<div class="wrong-list"><h2>أسئلة تحتاج مراجعة</h2><ul>${wrong
              .map((a) => `<li><p>${esc(a.q.q)}</p><p class="muted">الإجابة الصحيحة: <b>${esc(a.q.options[a.q.answer])}</b></p></li>`)
              .join("")}</ul><p class="muted">ستظهر لك في صفحة المراجعة في الوقت المناسب.</p></div>`
          : ""
      }
      <div class="actions center">
        <a class="btn primary" href="#${esc(s.backHref)}">متابعة</a>
        <button class="btn" id="retry">${s.mode === "review" ? "مراجعات أخرى" : "أعد الاختبار"}</button>
        <a class="btn ghost" href="#/">الرئيسية</a>
      </div>
    </section>`;
}
