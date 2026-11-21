// محرّر الدورة للمشرف: البيانات العامة، والدروس، والفيديوهات والصور، والأسئلة، والمهام ومعايير تصحيحها.
import { deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { FREE_PLAN, db, storage } from "../firebase.js";
import { renderMedia } from "../media.js";
import { loadCourses, loadSkillKeys } from "../store.js";
import { ar, errorMessage, esc, go, spinner, toast } from "../ui.js";

const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const blankQuestion = () => ({ id: uid("q"), q: "", options: ["", "", "", ""], answer: 0, explanation: "", difficulty: 2 });
const blankCriterion = () => ({ criterion: "", description: "", points: 25 });
const blankTask = () => ({
  id: uid("t"),
  type: "prompt",
  runPrompt: true,
  title: "",
  instructions: "",
  material: "",
  passScore: 70,
  rubric: [blankCriterion(), blankCriterion(), blankCriterion(), blankCriterion()],
});
const blankLesson = () => ({ id: uid("l"), title: "", minutes: 10, content: [], media: [], questions: [], tasks: [blankTask()] });

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}
function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const parent = keys.reduce((o, k) => o[k], obj);
  parent[last] = value;
}

export async function render(el, { courseId }) {
  el.innerHTML = spinner();
  const isNew = courseId === "new";
  const existing = isNew ? null : (await loadCourses(true)).find((c) => c.id === courseId);
  if (!isNew && !existing) {
    el.innerHTML = `<div class="card">لم نجد الدورة. <a href="#/admin">عودة</a></div>`;
    return;
  }
  const course = existing
    ? structuredClone(existing)
    : { id: "", title: "", description: "", icon: "🎓", level: "", order: Date.now(), lessons: [blankLesson()] };
  // حقول المهارة (التعريف، الوسائط، الأمثلة، الاختبار البعدي)
  course.intro ||= { definition: "", why: "", objectives: [], minutes: 60 };
  course.intro.objectives ||= [];
  course.video ||= { url: "", poster: "", captions: "", title: "" };
  course.infographic ||= { url: "", alt: "" };
  course.examples ||= [];
  course.postTest ||= { passScore: null, questions: [] };
  course.postTest.questions ||= [];
  course.number ??= course.order && course.order < 1000 ? course.order : "";
  // إجابات الاختبار البعدي محفوظة منفصلة (لا يقرؤها المتدرب)؛ ندمجها للتحرير فقط
  if (existing) {
    const keys = await loadSkillKeys(courseId).catch(() => ({}));
    for (const q of course.postTest.questions) {
      q.answer = keys[q.id]?.answer ?? 0;
      q.explanation = keys[q.id]?.explanation ?? "";
    }
  }
  for (const l of course.lessons) {
    l.media ||= [];
    l.questions ||= [];
    l.tasks ||= [];
    l.content ||= [];
  }
  let open = 0; // الدرس المفتوح
  let dirty = false;

  const field = (path, label, { type = "text", rows, placeholder = "", attrs = "" } = {}) => {
    const v = getPath(course, path) ?? "";
    const common = `data-path="${path}" ${type === "number" ? 'data-type="number"' : ""} placeholder="${esc(placeholder)}" ${attrs}`;
    const input = rows
      ? `<textarea rows="${rows}" ${common}>${esc(v)}</textarea>`
      : `<input type="${type}" value="${esc(v)}" ${common} />`;
    return `<label class="field">${label}${input}</label>`;
  };

  const questionsHtml = (list, base, removeKey, radioKey) =>
    list
      .map((q, qi) => {
        const qb = `${base}.${qi}`;
        q.options ||= ["", "", "", ""];
        return `<div class="sub-card">
          <div class="row between"><b>السؤال ${ar(qi + 1)}</b><button type="button" class="btn small ghost danger" data-remove="${removeKey}:${qi}">حذف</button></div>
          ${field(`${qb}.q`, "نص السؤال")}
          ${q.options
            .map(
              (o, oi) => `<div class="option-row"><input type="radio" name="${radioKey}-${qi}" data-answer="${qb}" value="${oi}" ${q.answer === oi ? "checked" : ""} aria-label="الإجابة الصحيحة" /><input data-path="${qb}.options.${oi}" value="${esc(o)}" placeholder="الخيار ${ar(oi + 1)}" /></div>`,
            )
            .join("")}
          <div class="grid-2 tight">
            ${field(`${qb}.explanation`, "الشرح")}
            <label class="field">الصعوبة<select data-path="${qb}.difficulty" data-type="number">${[1, 2, 3]
              .map((d) => `<option value="${d}" ${q.difficulty === d ? "selected" : ""}>${["", "سهل", "متوسط", "متقدم"][d]}</option>`)
              .join("")}</select></label>
          </div>
        </div>`;
      })
      .join("");

  function skillHtml() {
    return `
      <section class="card">
        <h2>🎯 التعريف والأهداف</h2>
        ${field("intro.definition", "تعريف المهارة", { rows: 3 })}
        ${field("intro.why", "لماذا تهمّ المتدرب؟", { rows: 2 })}
        <label class="field">الأهداف التعليمية <span class="muted small">(هدف في كل سطر)</span>
          <textarea rows="5" data-lines="intro.objectives">${esc(course.intro.objectives.join("\n"))}</textarea></label>
        ${field("intro.minutes", "المدة التقديرية (دقائق)", { type: "number" })}
      </section>
      <section class="card">
        <h2>🎬 الفيديو التعريفي والإنفوجرافيك</h2>
        <p class="muted small">ارفع الملفات أو الصق روابطها. للفيديوهات المدفوعة ننصح برابط Bunny Stream.</p>
        <div class="grid-2 tight">
          ${field("video.title", "عنوان الفيديو")}
          ${field("video.url", "رابط الفيديو (MP4)", { attrs: 'dir="ltr"' })}
          ${field("video.poster", "صورة الغلاف", { attrs: 'dir="ltr"' })}
          ${field("video.captions", "ملف الترجمة (VTT)", { attrs: 'dir="ltr"' })}
          ${field("infographic.url", "رابط الإنفوجرافيك", { attrs: 'dir="ltr"' })}
          ${field("infographic.alt", "وصف الإنفوجرافيك (للقارئات الصوتية)")}
        </div>
        <div class="row wrap" ${FREE_PLAN ? "hidden" : ""}>
          <label class="btn small">⬆ رفع فيديو<input type="file" accept="video/*" data-upload-set="video.url" hidden /></label>
          <label class="btn small">⬆ رفع صورة غلاف<input type="file" accept="image/*" data-upload-set="video.poster" hidden /></label>
          <label class="btn small">⬆ رفع إنفوجرافيك<input type="file" accept="image/*" data-upload-set="infographic.url" hidden /></label>
          <span class="muted small" data-upload-status="skill"></span>
        </div>
      </section>
      <section class="card">
        <h2>🖼️ أمثلة واقعية</h2>
        ${course.examples
          .map(
            (x, i) => `<div class="media-row">
              <div class="media-preview">${x.url ? `<img src="${esc(x.url)}" alt="" />` : ""}</div>
              <div class="grow">
                ${field(`examples.${i}.url`, "رابط الصورة", { attrs: 'dir="ltr" data-rerender' })}
                ${field(`examples.${i}.caption`, "العنوان")}
                ${field(`examples.${i}.note`, "التعليق التربوي", { rows: 2 })}
                <button type="button" class="btn small ghost danger" data-remove="examples:${i}">حذف</button>
              </div>
            </div>`,
          )
          .join("")}
        <div class="row wrap">
          <button type="button" class="btn small" data-add-example>+ مثال برابط</button>
          <label class="btn small" ${FREE_PLAN ? "hidden" : ""}>⬆ رفع صورة مثال<input type="file" accept="image/*" data-upload-push="examples" hidden /></label>
        </div>
      </section>
      <section class="card">
        <h2>🏁 الاختبار البعدي</h2>
        <label class="field">نسبة اجتياز خاصة بهذه المهارة (%) <span class="muted small">اتركها فارغة لاستخدام النسبة العامة من لوحة التحكم</span>
          <input type="number" min="1" max="100" data-pass-score value="${course.postTest.passScore ?? ""}" /></label>
        <p class="muted small">الإجابات الصحيحة تُحفظ منفصلة ولا تصل إلى متصفح المتدرب؛ التصحيح يتم في الخادم.</p>
        ${questionsHtml(course.postTest.questions, "postTest.questions", "postTest.questions", "pt")}
        <button type="button" class="btn small" data-add-posttest>+ سؤال</button>
      </section>`;
  }

  function lessonHtml(l, li) {
    const base = `lessons.${li}`;
    const rubricSum = (t) => t.rubric.reduce((s, c) => s + (Number(c.points) || 0), 0);
    return `
      <div class="editor-section">
        <div class="grid-2 tight">${field(`${base}.title`, "عنوان الدرس")}${field(`${base}.minutes`, "المدة (دقائق)", { type: "number" })}</div>
        <label class="field">محتوى الدرس <span class="muted small">(افصل الفقرات بسطر فارغ)</span>
          <textarea rows="8" data-content="${li}">${esc(l.content.join("\n\n"))}</textarea>
        </label>
      </div>

      <div class="editor-section">
        <h3>🎬 الفيديوهات والصور</h3>
        <p class="muted small">الصق رابط YouTube أو Vimeo أو Bunny Stream (موصى به للفيديوهات المدفوعة)، أو ارفع صورة أو فيديو قصيراً.</p>
        ${l.media
          .map(
            (m, mi) => `<div class="media-row">
              <div class="media-preview">${renderMedia(m) || '<span class="muted small">رابط غير صالح</span>'}</div>
              <div class="grow">
                <div class="grid-2 tight">
                  <label class="field">النوع<select data-path="${base}.media.${mi}.type"><option value="video" ${m.type === "video" ? "selected" : ""}>فيديو</option><option value="image" ${m.type === "image" ? "selected" : ""}>صورة</option></select></label>
                  ${field(`${base}.media.${mi}.caption`, "وصف قصير")}
                </div>
                ${field(`${base}.media.${mi}.url`, "الرابط", { attrs: 'dir="ltr" data-rerender' })}
                <div class="row"><button type="button" class="btn small ghost" data-move="${base}.media:${mi}:-1">↑</button><button type="button" class="btn small ghost" data-move="${base}.media:${mi}:1">↓</button><button type="button" class="btn small ghost danger" data-remove="${base}.media:${mi}">حذف</button></div>
              </div>
            </div>`,
          )
          .join("")}
        <div class="row wrap">
          <button type="button" class="btn small" data-add-media="${li}">+ رابط فيديو</button>
          <label class="btn small" ${FREE_PLAN ? "hidden" : ""}>⬆ رفع ملف<input type="file" accept="image/*,video/*" data-upload="${li}" hidden /></label>
          <span class="muted small" data-upload-status="${li}"></span>
        </div>
      </div>

      <div class="editor-section">
        <h3>🛠️ المهام التطبيقية (تصحيح ذاتي)</h3>
        ${l.tasks
          .map((t, ti) => {
            const tb = `${base}.tasks.${ti}`;
            const sum = rubricSum(t);
            return `<div class="sub-card">
              <div class="row between"><b>المهمة ${ar(ti + 1)}</b><button type="button" class="btn small ghost danger" data-remove="${base}.tasks:${ti}">حذف المهمة</button></div>
              ${field(`${tb}.title`, "عنوان المهمة")}
              <div class="grid-2 tight">
                <label class="field">النوع<select data-path="${tb}.type" data-rerender>
                  <option value="prompt" ${t.type === "prompt" ? "selected" : ""}>اختبار برومبت</option>
                  <option value="written" ${t.type === "written" ? "selected" : ""}>مهمة كتابية</option>
                </select></label>
                ${field(`${tb}.passScore`, "نسبة النجاح %", { type: "number", attrs: 'min="1" max="100"' })}
              </div>
              ${
                t.type === "prompt"
                  ? `<label class="check"><input type="checkbox" data-path="${tb}.runPrompt" ${t.runPrompt !== false ? "checked" : ""} /> شغّل برومبت المتدرب واعرض نتيجته قبل التقييم</label>`
                  : ""
              }
              ${field(`${tb}.instructions`, "التعليمات للمتدرب", { rows: 3 })}
              ${field(`${tb}.material`, "مادة مرفقة (اختياري) — نص يعمل عليه المتدرب أو برومبته", { rows: 3 })}
              <h4>معايير التقييم <span class="${sum === 100 ? "muted" : "warn"} small">(المجموع ${ar(sum)}${sum === 100 ? "" : " — يُفضَّل 100"})</span></h4>
              ${t.rubric
                .map(
                  (c, ci) => `<div class="rubric-row">
                    <input data-path="${tb}.rubric.${ci}.criterion" value="${esc(c.criterion)}" placeholder="المعيار" aria-label="المعيار" />
                    <input data-path="${tb}.rubric.${ci}.description" value="${esc(c.description)}" placeholder="وصف الأداء الممتاز" aria-label="الوصف" />
                    <input type="number" data-type="number" data-rerender data-path="${tb}.rubric.${ci}.points" value="${esc(c.points)}" min="1" max="100" aria-label="الدرجة" />
                    <button type="button" class="btn small ghost danger" data-remove="${tb}.rubric:${ci}" aria-label="حذف المعيار">✕</button>
                  </div>`,
                )
                .join("")}
              <button type="button" class="btn small" data-add-criterion="${tb}">+ معيار</button>
            </div>`;
          })
          .join("")}
        <button type="button" class="btn small" data-add-task="${li}">+ مهمة</button>
      </div>

      <div class="editor-section">
        <h3>🎯 أسئلة الاختبار التكيّفي</h3>
        ${questionsHtml(l.questions, `${base}.questions`, `${base}.questions`, `ans-${li}`)}
        <button type="button" class="btn small" data-add-question="${li}">+ سؤال</button>
      </div>

      <div class="row wrap">
        <button type="button" class="btn small ghost" data-move="lessons:${li}:-1">نقل الدرس للأعلى</button>
        <button type="button" class="btn small ghost" data-move="lessons:${li}:1">نقل الدرس للأسفل</button>
        <button type="button" class="btn small ghost danger" data-remove="lessons:${li}">حذف الدرس</button>
      </div>`;
  }

  function draw() {
    const y = window.scrollY;
    el.innerHTML = `
      <a class="back" href="#/admin">→ إدارة المحتوى</a>
      <form id="editor" class="editor" novalidate>
        <section class="card">
          <h1>${isNew ? "مهارة جديدة" : "تعديل المهارة"}</h1>
          <div class="grid-2 tight">
            ${field("title", "عنوان المهارة")}
            ${field("number", "رقم المهارة", { type: "number" })}
            ${isNew ? field("id", "معرّف الرابط (حروف إنجليزية صغيرة وأرقام وشرطات)", { attrs: 'dir="ltr" pattern="[a-z0-9][a-z0-9-]*"', placeholder: "ai-lesson-planning" }) : ""}
          </div>
          ${field("description", "الوصف", { rows: 2 })}
          ${field("cover", "صورة الغلاف (رابط)", { attrs: 'dir="ltr"' })}
          <div class="grid-2 tight">${field("icon", "رمز تعبيري")}${field("level", "المستوى أو الفئة")}${field("order", "الترتيب", { type: "number" })}</div>
          <label class="check"><input type="checkbox" data-path="comingSoon" ${course.comingSoon ? "checked" : ""} /> «قريباً»: تظهر في المسار دون محتوى</label>
        </section>
        ${skillHtml()}
        <section class="card">
          <h2>الدروس</h2>
          <div class="lesson-tabs" role="tablist">${course.lessons
            .map((l, i) => `<button type="button" role="tab" aria-selected="${i === open}" data-open="${i}">${ar(i + 1)}. ${esc(l.title || "درس بلا عنوان")}</button>`)
            .join("")}<button type="button" class="btn small" data-add-lesson>+ درس</button></div>
          ${course.lessons[open] ? lessonHtml(course.lessons[open], open) : '<p class="muted">أضف درساً.</p>'}
        </section>
        <div class="save-bar">
          <p class="form-error" role="alert"></p>
          <button class="btn primary" type="submit">حفظ ونشر</button>
          <a class="btn ghost" href="#/admin">إلغاء</a>
          ${isNew ? "" : `<button type="button" class="btn ghost danger" data-delete-course>حذف الدورة</button>`}
        </div>
      </form>`;
    window.scrollTo(0, y);
  }

  const listAt = (path) => getPath(course, path);
  const rerender = () => {
    dirty = true;
    draw();
  };

  el.addEventListener("input", (e) => {
    const t = e.target;
    dirty = true;
    if (t.dataset.content !== undefined) {
      course.lessons[Number(t.dataset.content)].content = t.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    } else if (t.dataset.lines) {
      setPath(course, t.dataset.lines, t.value.split("\n").map((x) => x.trim()).filter(Boolean));
    } else if (t.hasAttribute("data-pass-score")) {
      course.postTest.passScore = t.value === "" ? null : Math.min(100, Math.max(1, Number(t.value)));
    } else if (t.dataset.answer) {
      setPath(course, `${t.dataset.answer}.answer`, Number(t.value));
    } else if (t.dataset.path) {
      const v = t.type === "checkbox" ? t.checked : t.dataset.type === "number" ? Number(t.value) : t.value;
      setPath(course, t.dataset.path, v);
      if (t.dataset.path.endsWith(".title") && t.dataset.path.startsWith("lessons.")) {
        const tab = el.querySelector(`[data-open="${open}"]`);
        if (tab) tab.textContent = `${ar(open + 1)}. ${t.value || "درس بلا عنوان"}`;
      }
    }
  });
  el.addEventListener("change", (e) => {
    if (e.target.dataset.upload !== undefined) return upload(e.target);
    if (e.target.dataset.uploadSet || e.target.dataset.uploadPush) return uploadSkillFile(e.target);
    if (e.target.hasAttribute("data-rerender")) rerender();
  });

  async function upload(input) {
    const file = input.files[0];
    if (!file) return;
    const li = Number(input.dataset.upload);
    const status = el.querySelector(`[data-upload-status="${li}"]`);
    const id = course.id || "draft";
    const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-60);
    const task = uploadBytesResumable(ref(storage, `media/${id}/${Date.now()}-${safe}`), file, { contentType: file.type });
    task.on("state_changed", (s) => {
      if (status) status.textContent = `جارٍ الرفع ${ar(Math.round((s.bytesTransferred / s.totalBytes) * 100))}%`;
    });
    try {
      await task;
      const url = await getDownloadURL(task.snapshot.ref);
      course.lessons[li].media.push({ type: file.type.startsWith("video/") ? "video" : "image", url, caption: "" });
      rerender();
      toast("رُفع الملف. لا تنسَ الحفظ.", "success");
    } catch (err) {
      if (status) status.textContent = errorMessage(err);
    }
  }

  async function uploadSkillFile(input) {
    const file = input.files[0];
    if (!file) return;
    const status = el.querySelector('[data-upload-status="skill"]');
    const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-60);
    const task = uploadBytesResumable(ref(storage, `media/${course.id || "draft"}/${Date.now()}-${safe}`), file, { contentType: file.type });
    task.on("state_changed", (s) => {
      if (status) status.textContent = `جارٍ الرفع ${ar(Math.round((s.bytesTransferred / s.totalBytes) * 100))}%`;
    });
    try {
      await task;
      const url = await getDownloadURL(task.snapshot.ref);
      if (input.dataset.uploadSet) setPath(course, input.dataset.uploadSet, url);
      else course.examples.push({ url, caption: "", note: "" });
      rerender();
      toast("رُفع الملف. لا تنسَ الحفظ.", "success");
    } catch (err) {
      if (status) status.textContent = errorMessage(err);
    }
  }

  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const d = b.dataset;
    if (d.open) {
      open = Number(d.open);
      draw();
    } else if (d.addLesson !== undefined) {
      course.lessons.push(blankLesson());
      open = course.lessons.length - 1;
      rerender();
    } else if (d.addMedia) {
      course.lessons[Number(d.addMedia)].media.push({ type: "video", url: "", caption: "" });
      rerender();
    } else if (d.addTask) {
      course.lessons[Number(d.addTask)].tasks.push(blankTask());
      rerender();
    } else if (d.addCriterion) {
      listAt(d.addCriterion).rubric.push(blankCriterion());
      rerender();
    } else if (d.addExample !== undefined) {
      course.examples.push({ url: "", caption: "", note: "" });
      rerender();
    } else if (d.addPosttest !== undefined) {
      course.postTest.questions.push(blankQuestion());
      rerender();
    } else if (d.addQuestion) {
      course.lessons[Number(d.addQuestion)].questions.push(blankQuestion());
      rerender();
    } else if (d.remove) {
      const [path, i] = d.remove.split(":");
      if (path === "lessons" && !confirm("حذف هذا الدرس وكل محتواه؟")) return;
      listAt(path).splice(Number(i), 1);
      if (path === "lessons") open = Math.max(0, Math.min(open, course.lessons.length - 1));
      rerender();
    } else if (d.move) {
      const [path, i, dir] = d.move.split(":");
      const list = listAt(path);
      const a = Number(i);
      const bIdx = a + Number(dir);
      if (bIdx < 0 || bIdx >= list.length) return;
      [list[a], list[bIdx]] = [list[bIdx], list[a]];
      if (path === "lessons") open = bIdx;
      rerender();
    } else if (d.deleteCourse !== undefined) {
      if (!confirm(`حذف دورة «${course.title}» نهائياً؟ سيفقد المتدربون الوصول إليها.`)) return;
      await deleteDoc(doc(db, "courses", course.id));
      await loadCourses(true);
      dirty = false;
      toast("حُذفت الدورة.");
      go("/admin");
    }
  });

  el.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = el.querySelector(".save-bar .form-error");
    const problems = validate(course, isNew);
    if (problems.length) {
      errorEl.textContent = problems[0];
      return;
    }
    const btn = el.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      const { doc: skillDoc, keys } = clean(course);
      await setDoc(doc(db, "courses", course.id), skillDoc);
      await setDoc(doc(db, "courseKeys", course.id), { postTest: keys });
      await loadCourses(true);
      dirty = false;
      toast("حُفظت المهارة ونُشرت.", "success");
      go(`/course/${course.id}`);
    } catch (err) {
      errorEl.textContent = errorMessage(err);
      btn.disabled = false;
    }
  });

  const beforeUnload = (e) => {
    if (dirty) e.preventDefault();
  };
  window.addEventListener("beforeunload", beforeUnload);
  draw();
  return () => window.removeEventListener("beforeunload", beforeUnload);
}

function validate(course, isNew) {
  const p = [];
  if (!course.title.trim()) p.push("اكتب عنوان المهارة.");
  if (isNew && !/^[a-z0-9][a-z0-9-]{1,59}$/.test(course.id)) p.push("معرّف الرابط: حروف إنجليزية صغيرة وأرقام وشرطات فقط.");
  if (!course.lessons.length && !course.comingSoon) p.push("أضف درساً واحداً على الأقل، أو علّم المهارة «قريباً».");
  course.postTest.questions.forEach((q, qi) => {
    if (!q.q.trim() || q.options.some((o) => !o.trim())) p.push(`الاختبار البعدي، السؤال ${qi + 1}: أكمل النص وجميع الخيارات.`);
  });
  course.lessons.forEach((l, i) => {
    const n = `الدرس ${i + 1}`;
    if (!l.title.trim()) p.push(`${n}: اكتب عنواناً.`);
    l.questions.forEach((q, qi) => {
      if (!q.q.trim() || q.options.some((o) => !o.trim())) p.push(`${n}، السؤال ${qi + 1}: أكمل النص وجميع الخيارات.`);
    });
    l.tasks.forEach((t, ti) => {
      if (!t.title.trim() || !t.instructions.trim()) p.push(`${n}، المهمة ${ti + 1}: اكتب العنوان والتعليمات.`);
      if (!t.rubric.some((c) => c.criterion.trim())) p.push(`${n}، المهمة ${ti + 1}: أضف معيار تقييم واحداً على الأقل.`);
    });
  });
  return p;
}

function clean(course) {
  const keys = {};
  const ptQuestions = course.postTest.questions.map((q) => {
    keys[q.id] = { answer: Number(q.answer) || 0, explanation: (q.explanation || "").trim() };
    return { id: q.id, q: q.q.trim(), options: q.options.map((o) => o.trim()), difficulty: Number(q.difficulty) || 2 };
  });
  return { keys, doc: {
    id: course.id,
    title: course.title.trim(),
    description: course.description.trim(),
    icon: (course.icon || "📘").trim(),
    level: (course.level || "").trim(),
    cover: (course.cover || "").trim(),
    order: Number(course.order) || Date.now(),
    number: Number(course.number) || null,
    comingSoon: Boolean(course.comingSoon),
    intro: {
      definition: (course.intro.definition || "").trim(),
      why: (course.intro.why || "").trim(),
      objectives: course.intro.objectives,
      minutes: Number(course.intro.minutes) || 30,
    },
    video: Object.fromEntries(Object.entries(course.video).map(([k, v]) => [k, String(v || "").trim()])),
    infographic: { url: (course.infographic.url || "").trim(), alt: (course.infographic.alt || "").trim() },
    examples: course.examples.filter((x) => x.url.trim()).map((x) => ({ url: x.url.trim(), caption: (x.caption || "").trim(), note: (x.note || "").trim() })),
    postTest: { passScore: course.postTest.passScore ?? null, questions: ptQuestions },
    generated: Boolean(course.generated),
    updatedAt: serverTimestamp(),
    lessons: course.lessons.map((l) => ({
      id: l.id,
      title: l.title.trim(),
      skill: l.skill || `${course.id}-${l.id}`,
      minutes: Math.max(1, Number(l.minutes) || 10),
      content: l.content,
      media: l.media.filter((m) => m.url.trim()).map((m) => ({ type: m.type, url: m.url.trim(), caption: (m.caption || "").trim() })),
      questions: l.questions.map((q) => ({ ...q, q: q.q.trim(), options: q.options.map((o) => o.trim()), explanation: (q.explanation || "").trim() })),
      tasks: l.tasks.map((t) => ({
        id: t.id,
        type: t.type,
        runPrompt: t.type === "prompt" && t.runPrompt !== false,
        title: t.title.trim(),
        instructions: t.instructions.trim(),
        material: (t.material || "").trim(),
        passScore: Math.min(100, Math.max(1, Number(t.passScore) || 70)),
        rubric: t.rubric
          .filter((c) => c.criterion.trim())
          .map((c) => ({ criterion: c.criterion.trim(), description: (c.description || "").trim(), points: Math.max(1, Number(c.points) || 1) })),
      })),
    })),
  } };
}
