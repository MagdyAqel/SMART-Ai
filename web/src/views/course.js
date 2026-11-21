// صفحة المهارة: التعريف والأهداف ← الفيديو ← الإنفوجرافيك ← أمثلة واقعية ← الدروس والتطبيق ← الاختبار البعدي.
// ترتيب العرض (مسار رأسي، بطاقات، تبويبات) يحدده قالب العرض الذي اختاره المتدرب.
import { lessonKey } from "../engine.js";
import { loadCourses, loadSettings, markStep, skillPassScore, skillStatuses, state, taskKey } from "../store.js";
import { ar, esc, progressBar, spinner } from "../ui.js";

const STEPS = [
  { id: "intro", icon: "🎯", label: "التعريف والأهداف" },
  { id: "video", icon: "🎬", label: "الفيديو التعريفي" },
  { id: "infographic", icon: "🗺️", label: "الإنفوجرافيك" },
  { id: "examples", icon: "🖼️", label: "أمثلة واقعية" },
  { id: "lessons", icon: "📚", label: "الدروس والتطبيق" },
  { id: "posttest", icon: "🏁", label: "الاختبار البعدي" },
];

export async function render(el, { courseId }) {
  el.innerHTML = spinner();
  const [skills, settings] = await Promise.all([loadCourses(), loadSettings()]);
  const skill = skills.find((c) => c.id === courseId);
  if (!skill) {
    el.innerHTML = `<div class="card">لم نجد هذه المهارة. <a href="#/courses">عودة للمهارات</a></div>`;
    return;
  }
  const st = skillStatuses(skills, state.progress, settings, state.isAdmin).get(skill.id);
  if (st.status === "locked" || st.status === "soon") {
    el.innerHTML = `<a class="back" href="#/courses">→ المهارات</a>
      <section class="card lock-card"><span class="lock-icon" aria-hidden="true">${st.status === "soon" ? "⏳" : "🔒"}</span>
        <h1>${esc(skill.title)}</h1>
        <p>${
          st.status === "soon"
            ? "يُضاف محتوى هذه المهارة قريباً."
            : `تُفتح هذه المهارة عندما تجتاز الاختبار البعدي لمهارة «${esc(st.requires?.title)}» بنسبة ${ar(skillPassScore(st.requires, settings))}% أو أكثر.`
        }</p>
        ${st.requires ? `<a class="btn primary" href="#/course/${esc(st.requires.id)}">اذهب إلى المهارة المطلوبة</a>` : ""}
      </section>`;
    return;
  }

  const p = state.progress;
  const seen = p.steps?.[skill.id] || {};
  const lessons = skill.lessons || [];
  const lessonsDone = lessons.filter((l) => p.completed[lessonKey(skill.id, l.id)]).length;
  const passScore = skillPassScore(skill, settings);
  const test = p.postTests?.[skill.id];
  const done = {
    intro: Boolean(seen.intro),
    video: Boolean(seen.video),
    infographic: Boolean(seen.infographic),
    examples: Boolean(seen.examples),
    lessons: lessons.length > 0 && lessonsDone === lessons.length,
    posttest: Boolean(test?.passed),
  };
  const doneCount = Object.values(done).filter(Boolean).length;
  const ordered = [...skills].filter((s) => !s.comingSoon).sort((a, b) => a.order - b.order);
  const next = ordered[ordered.indexOf(skill) + 1];
  const intro = skill.intro || {};

  const sections = {
    intro: `
      <div class="definition"><span class="def-label">تعريف المهارة</span><p>${esc(intro.definition || skill.description)}</p></div>
      ${intro.why ? `<h3>لماذا تهمّك؟</h3><p>${esc(intro.why)}</p>` : ""}
      ${
        intro.objectives?.length
          ? `<h3>بعد إتمام المهارة ستكون قادراً على أن:</h3><ol class="objectives">${intro.objectives.map((o) => `<li>${esc(o)}</li>`).join("")}</ol>`
          : ""
      }
      <p class="muted small">⏱️ المدة التقديرية: ${ar(intro.minutes || 30)} دقيقة · ${ar(lessons.length)} دروس · اختبار بعدي من ${ar(
        skill.postTest?.questions?.length || 0,
      )} أسئلة</p>`,
    video: skill.video?.url
      ? `<figure class="video-player">
          <video controls preload="metadata" playsinline controlsList="nodownload" ${skill.video.poster ? `poster="${esc(skill.video.poster)}"` : ""}>
            <source src="${esc(skill.video.url)}" type="video/mp4" />
            ${skill.video.captions ? `<track kind="captions" srclang="ar" label="العربية" src="${esc(skill.video.captions)}" />` : ""}
          </video>
          <figcaption>${esc(skill.video.title || "")} <span class="muted small">· يمكنك تفعيل الترجمة العربية من زر CC</span></figcaption>
        </figure>`
      : `<p class="muted">سيُضاف الفيديو قريباً.</p>`,
    infographic: skill.infographic?.url
      ? `<figure class="infographic">
          <a href="${esc(skill.infographic.url)}" target="_blank" rel="noopener"><img src="${esc(skill.infographic.url)}" alt="${esc(
            skill.infographic.alt || "",
          )}" loading="lazy" /></a>
          <figcaption><a class="btn small" href="${esc(skill.infographic.url)}" download>⬇ تنزيل الإنفوجرافيك</a>
          <span class="muted small">اضغط الصورة لعرضها بالحجم الكامل</span></figcaption>
        </figure>`
      : `<p class="muted">سيُضاف الإنفوجرافيك قريباً.</p>`,
    examples: (skill.examples || []).length
      ? `<div class="examples">${skill.examples
          .map(
            (x) => `<figure class="example"><img src="${esc(x.url)}" alt="${esc(x.caption)}" loading="lazy" />
              <figcaption><b>${esc(x.caption)}</b>${x.note ? `<p>${esc(x.note)}</p>` : ""}</figcaption></figure>`,
          )
          .join("")}</div>`
      : `<p class="muted">ستُضاف الأمثلة قريباً.</p>`,
    lessons: `
      <ol class="lesson-steps">${lessons
        .map((l, i) => {
          const d = p.completed[lessonKey(skill.id, l.id)];
          const tasks = (l.tasks || [])
            .map((t) => {
              const r = p.tasks?.[taskKey(skill.id, l.id, t.id)];
              return `<a class="task-chip ${r?.passed ? "ok" : ""}" href="#/task/${esc(skill.id)}/${esc(l.id)}/${esc(t.id)}">${
                t.type === "prompt" ? "💬" : "📝"
              } ${esc(t.title)}${r ? ` · ${ar(r.best)}%` : ""}</a>`;
            })
            .join("");
          return `<li class="${d ? "done" : ""}">
            <span class="num" aria-hidden="true">${d ? "✓" : ar(i + 1)}</span>
            <div class="grow"><a class="lesson-link" href="#/lesson/${esc(skill.id)}/${esc(l.id)}">${esc(l.title)}</a>
              <p class="muted small">${ar(l.minutes || 10)} دقيقة${d ? ` · أفضل نتيجة ${ar(d.best)}%` : ""}</p>
              ${tasks ? `<div class="task-chips">${tasks}</div>` : ""}</div>
            <a class="btn small ${d ? "" : "primary"}" href="#/lesson/${esc(skill.id)}/${esc(l.id)}">${d ? "مراجعة" : "ابدأ"}</a>
          </li>`;
        })
        .join("")}</ol>`,
    posttest: `
      <div class="posttest-card ${test?.passed ? "passed" : ""}">
        <div>
          <p>${ar(skill.postTest?.questions?.length || 0)} أسئلة تقيس أهداف المهارة. نسبة الاجتياز: <b>${ar(passScore)}%</b></p>
          ${
            test
              ? `<p class="muted">محاولاتك: ${ar(test.attempts)} · أفضل نتيجة: <b>${ar(test.best)}%</b></p>`
              : `<p class="muted">ننصحك بإنهاء الدروس والمهام التطبيقية قبل الاختبار.</p>`
          }
        </div>
        ${
          test?.passed
            ? `<div class="passed-box">✅ اجتزت هذه المهارة${next ? `<a class="btn primary" href="#/course/${esc(next.id)}">المهارة التالية ←</a>` : ""}</div>`
            : skill.postTest?.questions?.length
              ? `<a class="btn primary" href="#/posttest/${esc(skill.id)}">${test ? "أعد الاختبار" : "ابدأ الاختبار البعدي"}</a>`
              : `<p class="muted">سيُضاف الاختبار قريباً.</p>`
        }
      </div>`,
  };

  el.innerHTML = `
    <a class="back" href="#/courses">→ المهارات</a>
    <header class="skill-hero ${skill.cover ? "has-cover" : ""}" ${skill.cover ? `style="--cover:url('${esc(skill.cover)}')"` : ""}>
      <span class="hero-icon" aria-hidden="true">${esc(skill.icon || "📘")}</span>
      <div class="grow">
        <p class="hero-kicker">المهارة ${ar(skill.number ?? skill.order)}</p>
        <h1>${esc(skill.title)}</h1>
        <p class="muted">${esc(skill.description || "")}</p>
        <div class="row">${progressBar((doneCount / STEPS.length) * 100, "تقدّمك في المهارة")}<span class="small">${ar(doneCount)} من ${ar(
          STEPS.length,
        )} مراحل</span></div>
      </div>
    </header>
    <nav class="step-tabs" role="tablist" aria-label="مراحل المهارة">${STEPS.map(
      (s, i) => `<button role="tab" id="tab-${s.id}" aria-controls="step-${s.id}" aria-selected="${i === 0}" data-step="${s.id}" class="${
        done[s.id] ? "done" : ""
      }"><span aria-hidden="true">${done[s.id] ? "✓" : s.icon}</span> ${s.label}</button>`,
    ).join("")}</nav>
    <div class="skill-steps">${STEPS.map(
      (s, i) => `<section class="skill-step ${done[s.id] ? "done" : ""} step-${s.id}" id="step-${s.id}" role="tabpanel" aria-labelledby="tab-${s.id}" data-step="${s.id}" ${
        i === 0 ? "" : 'data-inactive=""'
      }>
        <h2><span class="step-num" aria-hidden="true">${done[s.id] ? "✓" : ar(i + 1)}</span><span aria-hidden="true">${s.icon}</span> ${s.label}</h2>
        <div class="step-body">${sections[s.id]}</div>
      </section>`,
    ).join("")}</div>`;

  // التبويبات (في القوالب التي تعرض المهارة كتبويبات)
  const show = (id) => {
    el.querySelectorAll(".step-tabs [role=tab]").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.step === id)));
    el.querySelectorAll(".skill-step").forEach((s) => (s.dataset.step === id ? s.removeAttribute("data-inactive") : s.setAttribute("data-inactive", "")));
    if (id === "infographic" || id === "examples" || id === "intro") markStep(skill.id, id);
  };
  el.querySelector(".step-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]");
    if (b) show(b.dataset.step);
  });

  // تسجيل المراحل التي اطّلع عليها المتدرب
  markStep(skill.id, "intro");
  const video = el.querySelector("video");
  video?.addEventListener("timeupdate", () => {
    if (video.duration && video.currentTime / video.duration > 0.8) markStep(skill.id, "video");
  });
  video?.addEventListener("error", () => video.closest("figure").insertAdjacentHTML("beforeend", '<p class="muted">تعذّر تحميل الفيديو.</p>'), true);
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting && document.documentElement.dataset.layout !== "tabs") markStep(skill.id, en.target.dataset.step);
      }),
    { threshold: 0.4 },
  );
  el.querySelectorAll(".step-infographic, .step-examples").forEach((s) => io.observe(s));
  return () => io.disconnect();
}
