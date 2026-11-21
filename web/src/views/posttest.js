// الاختبار البعدي: يُصحَّح في الخادم، ويفتح المهارة التالية عند الاجتياز.
import { callSubmitPostTest } from "../firebase.js";
import { loadCourses, loadSettings, saveProgress, skillPassScore, skillStatuses, state } from "../store.js";
import { ar, errorMessage, esc, go, spinner, toast } from "../ui.js";

const LETTERS = ["أ", "ب", "ج", "د", "هـ", "و"];
const POSTTEST_XP = 50;

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function render(el, { courseId }) {
  el.innerHTML = spinner();
  const [skills, settings] = await Promise.all([loadCourses(), loadSettings()]);
  const skill = skills.find((s) => s.id === courseId);
  const st = skill && skillStatuses(skills, state.progress, settings, state.isAdmin).get(courseId);
  if (!skill || !st || st.status === "locked" || st.status === "soon") return go(`/course/${courseId}`);
  const questions = shuffle(skill.postTest?.questions || []);
  const passScore = skillPassScore(skill, settings);
  const answers = {};

  el.innerHTML = `
    <a class="back" href="#/course/${esc(courseId)}">→ ${esc(skill.title)}</a>
    <section class="card posttest-intro">
      <p class="hero-kicker">الاختبار البعدي · المهارة ${ar(skill.number ?? skill.order)}</p>
      <h1>${esc(skill.title)}</h1>
      <p>${ar(questions.length)} أسئلة · نسبة الاجتياز <b>${ar(passScore)}%</b> · يمكنك إعادة الاختبار إن لم تجتزه.</p>
      ${progressHtml(0, questions.length)}
    </section>
    <form id="pt-form" class="pt-form">
      ${questions
        .map(
          (q, i) => `<fieldset class="card pt-q" data-q="${esc(q.id)}">
            <legend><span class="pt-n">${ar(i + 1)}</span>${esc(q.q)}</legend>
            <div class="options">${q.options
              .map(
                (o, oi) => `<label class="option pt-opt"><input type="radio" name="${esc(q.id)}" value="${oi}" /><span class="letter">${
                  LETTERS[oi]
                }</span><span>${esc(o)}</span></label>`,
              )
              .join("")}</div>
            <div class="pt-feedback" hidden></div>
          </fieldset>`,
        )
        .join("")}
      <div class="save-bar"><p class="form-error" role="alert"></p>
        <button class="btn primary" type="submit">سلّم الاختبار</button>
        <span class="muted small" id="pt-count"></span></div>
    </form>
    <div id="pt-result"></div>`;

  const form = el.querySelector("#pt-form");
  const count = el.querySelector("#pt-count");
  const updateCount = () => {
    const n = Object.keys(answers).length;
    count.textContent = `أجبت عن ${ar(n)} من ${ar(questions.length)}`;
    el.querySelector(".posttest-intro .bar").outerHTML = progressHtml(n, questions.length);
  };
  updateCount();
  form.addEventListener("change", (e) => {
    if (e.target.name) {
      answers[e.target.name] = Number(e.target.value);
      updateCount();
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = form.querySelector(".form-error");
    const missing = questions.length - Object.keys(answers).length;
    if (missing > 0 && !confirm(`لم تُجب عن ${ar(missing)} أسئلة، وستُحسب خطأ. هل تريد التسليم؟`)) return;
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    btn.textContent = "نصحّح…";
    try {
      const { data } = await callSubmitPostTest({ courseId, answers });
      // نحدّث النسخة المحلية بنتيجة الخادم
      const tests = { ...(state.progress.postTests || {}) };
      const prev = tests[courseId];
      tests[courseId] = { best: Math.max(prev?.best ?? 0, data.pct), passed: Boolean(prev?.passed) || data.passed, attempts: (prev?.attempts ?? 0) + 1, lastAt: Date.now() };
      saveProgress({ ...state.progress, postTests: tests, xp: state.progress.xp + (data.firstPass ? POSTTEST_XP : 0) });
      showResult(el, skill, skills, data);
    } catch (err) {
      errorEl.textContent = errorMessage(err);
      btn.disabled = false;
      btn.textContent = "سلّم الاختبار";
    }
  });
}

function progressHtml(n, total) {
  const v = total ? Math.round((n / total) * 100) : 0;
  return `<div class="bar" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100" aria-label="الأسئلة المُجاب عنها"><span style="width:${v}%"></span></div>`;
}

function showResult(el, skill, skills, r) {
  const byId = new Map(r.results.map((x) => [x.id, x]));
  el.querySelectorAll(".pt-q").forEach((fs) => {
    const res = byId.get(fs.dataset.q);
    fs.classList.add(res?.correct ? "right" : "wrong");
    fs.querySelectorAll("input").forEach((i) => (i.disabled = true));
    if (r.passed && res) {
      fs.querySelectorAll(".pt-opt").forEach((lab, oi) => {
        if (oi === res.answer) lab.classList.add("correct");
        else if (oi === res.chosen) lab.classList.add("wrong");
      });
      if (res.explanation) {
        const fb = fs.querySelector(".pt-feedback");
        fb.hidden = false;
        fb.textContent = res.explanation;
      }
    }
  });
  el.querySelector(".save-bar").remove();
  const ordered = skills.filter((s) => !s.comingSoon).sort((a, b) => a.order - b.order);
  const next = ordered[ordered.indexOf(skill) + 1];
  const wrong = r.results.filter((x) => !x.correct).length;
  if (r.firstPass) toast(`مبارك! اجتزت المهارة +${ar(POSTTEST_XP)} نقطة`, "success");
  const box = el.querySelector("#pt-result");
  box.innerHTML = `<section class="card summary">
    <h1>${r.passed ? "🎉 اجتزت المهارة" : "لم تصل إلى نسبة الاجتياز بعد"}</h1>
    <div class="score-ring" style="--p:${r.pct}"><span>${ar(r.pct)}%</span></div>
    <p>${ar(r.score)} إجابات صحيحة من ${ar(r.total)} · نسبة الاجتياز ${ar(r.passScore)}%</p>
    ${
      r.passed
        ? `<p>أصبحت المهارة التالية متاحة لك. راجع الشرح تحت كل سؤال.</p>`
        : `<p>أخطأت في ${ar(wrong)} أسئلة (مُعلّمة باللون الأحمر). راجع الدروس والإنفوجرافيك، ثم أعد المحاولة؛ تتغيّر ترتيب الأسئلة في كل محاولة.</p>`
    }
    <div class="actions center">
      ${r.passed && next ? `<a class="btn primary" href="#/course/${esc(next.id)}">المهارة التالية: ${esc(next.title)} ←</a>` : ""}
      ${r.passed ? "" : `<a class="btn primary" href="#/course/${esc(skill.id)}">راجع المهارة</a><a class="btn" href="#/posttest/${esc(skill.id)}" id="retry">أعد الاختبار</a>`}
    </div>
  </section>`;
  box.querySelector("#retry")?.addEventListener("click", (e) => {
    e.preventDefault();
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  box.scrollIntoView({ behavior: "smooth" });
}
