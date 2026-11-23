import { ref, uploadBytesResumable } from "firebase/storage";
import { FREE_PLAN, auth, callGradeSubmission, storage } from "../firebase.js";
import { findLesson, saveProgress, state, taskKey } from "../store.js";
import { ar, errorMessage, esc, spinner, toast } from "../ui.js";
import { bindCopy, gradeResultHtml } from "./grade-result.js";

const TASK_XP = 30;
// الملفات التي يقبلها التصحيح الآلي (تطابق قواعد Storage والخادم)
const ACCEPT = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
  "image/png": "صورة",
  "image/jpeg": "صورة",
  "image/webp": "صورة",
  "text/plain": "نص",
  "text/markdown": "نص",
};
const MAX_MB = 10;
const drafts = new Map(); // مسودات المتدرب طوال الجلسة

export async function render(el, { courseId, lessonId, taskId }) {
  el.innerHTML = spinner();
  const { course, lesson } = await findLesson(courseId, lessonId);
  const task = lesson?.tasks?.find((t) => t.id === taskId);
  if (!task) {
    el.innerHTML = `<div class="card">لم نجد هذه المهمة. <a href="#/courses">عودة للدورات</a></div>`;
    return;
  }
  const key = taskKey(courseId, lessonId, taskId);
  const prev = state.progress.tasks?.[key];
  const isPrompt = task.type === "prompt";

  el.innerHTML = `
    <a class="back" href="#/lesson/${esc(courseId)}/${esc(lessonId)}">→ ${esc(lesson.title)}</a>
    <section class="card">
      <p class="muted">${isPrompt ? "💬 اختبار برومبت" : "📝 مهمة كتابية"} · ${esc(course.title)}</p>
      <h1>${esc(task.title)}</h1>
      <p>${esc(task.instructions).replace(/\n/g, "<br>")}</p>
      ${task.material ? `<details class="material" open><summary>المادة المرفقة</summary><p>${esc(task.material).replace(/\n/g, "<br>")}</p></details>` : ""}
      <details class="rubric"><summary>معايير التقييم (${ar(task.rubric.length)}) · النجاح من ${ar(task.passScore || 70)}%</summary>
        <ul>${task.rubric.map((c) => `<li><b>${esc(c.criterion)}</b> — ${ar(c.points)} درجة${c.description ? `<br><span class="muted">${esc(c.description)}</span>` : ""}</li>`).join("")}</ul>
      </details>
      ${prev ? `<p class="muted">محاولاتك: ${ar(prev.attempts)} · أفضل نتيجة ${ar(prev.best)}%${prev.passed ? " · ✓ اجتزت" : ""}</p>` : ""}
    </section>
    ${FREE_PLAN ? `<div class="card notice-card">🛠️ نفّذ المهمة وقيّم عملك بنفسك وفق المعايير أعلاه. التصحيح التلقائي بالذكاء الاصطناعي يُفعَّل عند ترقية المنصة.</div>` : ""}
    <form class="card" id="submit-form" ${FREE_PLAN ? "hidden" : ""}>
      ${
        isPrompt
          ? ""
          : `<div class="seg-toggle" role="radiogroup" aria-label="طريقة التسليم">
              <label><input type="radio" name="mode" value="text" checked /> ✍️ أكتب الإجابة هنا</label>
              <label><input type="radio" name="mode" value="file" /> 📎 أرفع ملف الواجب</label>
            </div>
            <div class="upload-box" data-mode="file" hidden>
              <label class="drop">
                <input type="file" name="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.txt,.md" />
                <span class="drop-icon" aria-hidden="true">📄</span>
                <span class="drop-text">اختر ملف الواجب أو اسحبه هنا</span>
                <span class="muted small">PDF أو Word أو صورة أو نص · حتى ${ar(MAX_MB)} ميغابايت</span>
              </label>
              <div class="file-chip" hidden></div>
              <progress class="up-progress" max="100" value="0" hidden></progress>
            </div>`
      }
      <label class="field" data-mode="text">${isPrompt ? "اكتب برومبتك" : "إجابتك"}
        <textarea name="answer" rows="${isPrompt ? 8 : 12}" maxlength="8000" placeholder="${
          isPrompt ? "أنت معلم... اكتب..." : "اكتب إجابتك هنا"
        }"></textarea>
      </label>
      <label class="field" data-mode="file" hidden>ملاحظة للمصحّح (اختيارية)
        <textarea name="note" rows="3" maxlength="1000" placeholder="مثلاً: الصف الذي طبّقت فيه، أو ما تريد التركيز عليه"></textarea>
      </label>
      <div class="row wrap"><span class="muted small" id="count"></span></div>
      <p class="form-error" role="alert"></p>
      <button class="btn primary" type="submit">${isPrompt ? "شغّل البرومبت وصحّحه" : "صحّح إجابتي"}</button>
    </form>
    <div id="result"></div>`;

  const form = el.querySelector("#submit-form");
  const area = form.answer;
  const count = el.querySelector("#count");
  const errorEl = form.querySelector(".form-error");
  const result = el.querySelector("#result");
  area.value = drafts.get(key) || "";
  const updateCount = () => {
    drafts.set(key, area.value);
    const words = area.value.trim() ? area.value.trim().split(/\s+/).length : 0;
    count.textContent = `${ar(words)} كلمة · ${ar(area.value.length)} / ${ar(8000)} حرف`;
  };
  area.addEventListener("input", updateCount);
  updateCount();

  // التبديل بين كتابة الإجابة ورفع ملف
  const fileInput = form.file;
  const chip = form.querySelector(".file-chip");
  const bar = form.querySelector(".up-progress");
  const mode = () => (isPrompt ? "text" : form.mode.value);
  const applyMode = () => form.querySelectorAll("[data-mode]").forEach((n) => (n.hidden = n.dataset.mode !== mode()));
  form.querySelectorAll("input[name=mode]").forEach((r) => r.addEventListener("change", applyMode));
  fileInput?.addEventListener("change", () => {
    const f = fileInput.files[0];
    errorEl.textContent = "";
    if (!f) return (chip.hidden = true);
    if (!ACCEPT[f.type]) errorEl.textContent = "نوع الملف غير مدعوم. ارفع PDF أو Word أو صورة أو نصاً.";
    else if (f.size > MAX_MB * 1024 * 1024) errorEl.textContent = `حجم الملف أكبر من ${ar(MAX_MB)} ميغابايت.`;
    chip.hidden = false;
    chip.textContent = `${ACCEPT[f.type] || "ملف"} · ${f.name} · ${ar(Math.max(1, Math.round(f.size / 1024)))} ك.ب`;
  });

  // يرفع الملف إلى مجلد المتدرب ويعيد مساره (لا يُرسل الملف نفسه إلى الدالة)
  const uploadFile = (f) =>
    new Promise((resolve, reject) => {
      const safe = f.name.replace(/[^\w.-]+/g, "_").slice(-60);
      const path = `submissions/${auth.currentUser.uid}/${courseId}/${taskId}/${Date.now()}-${safe}`;
      const up = uploadBytesResumable(ref(storage, path), f, { contentType: f.type, customMetadata: { originalName: f.name.slice(0, 120) } });
      bar.hidden = false;
      up.on(
        "state_changed",
        (snap) => (bar.value = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        () => resolve(path),
      );
    });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const useFile = mode() === "file";
    const f = useFile ? fileInput.files[0] : null;
    const answer = useFile ? form.note.value.trim() : area.value.trim();
    if (useFile && !f) return (errorEl.textContent = "اختر ملف الواجب أولاً.");
    if (useFile && (!ACCEPT[f.type] || f.size > MAX_MB * 1024 * 1024)) return (errorEl.textContent = "تحقق من نوع الملف وحجمه.");
    if (!useFile && answer.length < 20) {
      errorEl.textContent = "الإجابة قصيرة جداً، اكتب 20 حرفاً على الأقل.";
      return;
    }
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    btn.innerHTML = `<span class="spin" aria-hidden="true"></span> ${isPrompt ? "نشغّل برومبتك ثم نصحّحه…" : useFile ? "نرفع الملف ثم نصحّحه…" : "نصحّح إجابتك…"}`;
    result.innerHTML = "";
    try {
      const filePath = f ? await uploadFile(f) : null;
      const { data } = await callGradeSubmission({ courseId, lessonId, taskId, answer, filePath });
      // نحدّث نسخة التقدّم المحلية بنتيجة الخادم، ونمنح نقاط أول نجاح.
      const tasks = { ...(state.progress.tasks || {}) };
      const old = tasks[key];
      tasks[key] = {
        best: Math.max(old?.best ?? 0, data.pct),
        passed: Boolean(old?.passed) || data.passed,
        attempts: (old?.attempts ?? 0) + 1,
        lastAt: Date.now(),
      };
      saveProgress({ ...state.progress, tasks, xp: state.progress.xp + (data.firstPass ? TASK_XP : 0) });
      if (data.firstPass) toast(`أحسنت! اجتزت المهمة +${ar(TASK_XP)} نقطة`, "success");
      result.innerHTML = gradeResultHtml(data);
      bindCopy(result, data.improved);
      result.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      errorEl.textContent = errorMessage(err);
    } finally {
      if (bar) bar.hidden = true;
      if (btn.isConnected) {
        btn.disabled = false;
        btn.textContent = isPrompt ? "شغّل البرومبت وصحّحه" : "صحّح إجابتي";
      }
    }
  });
}
