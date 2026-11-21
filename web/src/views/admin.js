import { callGenerateCourse } from "../firebase.js";
import { loadCourses } from "../store.js";
import { ar, errorMessage, esc, go, spinner, toast } from "../ui.js";

export async function render(el) {
  el.innerHTML = spinner();
  const courses = await loadCourses(true);
  el.innerHTML = `
    <h1 class="page-title">🛠️ إدارة المحتوى</h1>
    <section class="card">
      <div class="row wrap between"><h2>الدورات</h2><a class="btn primary small" href="#/admin/course/new">+ دورة جديدة</a></div>
      ${
        courses.length
          ? `<ul class="review-list">${courses
              .map(
                (c) => `<li><span>${esc(c.icon || "📘")} ${esc(c.title)}</span><span class="row"><span class="muted small">${ar(c.lessons.length)} دروس · ${ar(
                  c.lessons.reduce((s, l) => s + (l.tasks?.length || 0), 0),
                )} مهام</span><a class="btn small" href="#/admin/course/${esc(c.id)}">تعديل</a></span></li>`,
              )
              .join("")}</ul>`
          : `<p class="muted">لا توجد دورات بعد.</p>`
      }
    </section>

    <form class="card form" id="course-form">
      <h2>✨ أنشئ مسودة دورة بالذكاء الاصطناعي</h2>
      <p class="muted">يكتب المدرّب الذكي الدروس والأسئلة والمهام التطبيقية ومعايير تصحيحها، ثم تراجعها وتضيف فيديوهاتك من المحرّر.</p>
      <label class="field">موضوع الدورة
        <input name="topic" required minlength="3" maxlength="200" placeholder="مثال: استخدام ChatGPT في تصميم الأنشطة الصفية" />
      </label>
      <label class="field">الفئة المستهدفة (اختياري)
        <input name="audience" maxlength="200" placeholder="مثال: معلمو المرحلة الابتدائية" />
      </label>
      <label class="field">عدد الدروس
        <select name="lessonCount">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === 3 ? "selected" : ""}>${ar(n)}</option>`).join("")}</select>
      </label>
      <p class="form-error" role="alert"></p>
      <button class="btn primary" type="submit">أنشئ الدورة</button>
      <p class="muted small">قد يستغرق الإنشاء دقيقة أو أكثر، وتُنشر الدورة مباشرة؛ راجعها بعد إنشائها.</p>
    </form>`;

  const form = el.querySelector("#course-form");
  const errorEl = form.querySelector(".form-error");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    btn.innerHTML = `<span class="spin" aria-hidden="true"></span> يبني المدرّب الدورة…`;
    try {
      const { data } = await callGenerateCourse({
        topic: form.topic.value.trim(),
        audience: form.audience.value.trim(),
        lessonCount: Number(form.lessonCount.value),
      });
      await loadCourses(true);
      toast(`أُنشئت دورة «${data.title}» (${ar(data.lessons)} دروس)`, "success");
      go(`/admin/course/${data.id}`);
    } catch (err) {
      errorEl.textContent = errorMessage(err);
    } finally {
      if (btn.isConnected) {
        btn.disabled = false;
        btn.textContent = "أنشئ الدورة";
      }
    }
  });
}
