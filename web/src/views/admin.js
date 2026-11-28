import { callGenerateCourse } from "../firebase.js";
import { doc, setDoc } from "firebase/firestore";
import { FREE_PLAN, db } from "../firebase.js";
import { loadCourses, loadSettings } from "../store.js";
import { ar, errorMessage, esc, go, spinner, toast } from "../ui.js";

export async function render(el) {
  el.innerHTML = spinner();
  const [courses, settings] = await Promise.all([loadCourses(true), loadSettings(true)]);
  el.innerHTML = `
    <h1 class="page-title">🛠️ لوحة التحكم</h1>
    <nav class="row wrap admin-links" aria-label="أقسام الإدارة">
      <a class="btn primary" href="#/admin/users">👥 المستخدمون وخيارات الدخول</a>
      <a class="btn" href="#/admin/reports">📊 التقارير</a>
    </nav>
    <form class="card form" id="settings-form">
      <h2>⚙️ الانتقال بين المهارات</h2>
      <div class="grid-2 tight">
        <label class="field">نسبة النجاح في الاختبار البعدي للانتقال (%)
          <input type="number" name="passScore" min="1" max="100" required value="${settings.passScore}" />
        </label>
        <label class="check"><input type="checkbox" name="sequential" ${settings.sequential !== false ? "checked" : ""} /> الانتقال متسلسل: لا تُفتح المهارة إلا بعد اجتياز السابقة</label>
      </div>
      <p class="muted small">تنطبق على كل المهارات، إلا مهارة حدّدت لها نسبة خاصة من محرّرها.</p>
      <button class="btn primary" type="submit">حفظ الإعدادات</button>
    </form>
    <section class="card">
      <div class="row wrap between"><h2>المهارات</h2><a class="btn primary small" href="#/admin/course/new">+ مهارة جديدة</a></div>
      ${
        courses.length
          ? `<ul class="review-list">${courses
              .map(
                (c) => `<li><span>${esc(c.icon || "📘")} ${esc(c.title)}${c.comingSoon ? ' <span class="tag">قريباً</span>' : ""}</span><span class="row"><span class="muted small">${ar(c.lessons.length)} دروس · ${ar(
                  c.lessons.reduce((s, l) => s + (l.tasks?.length || 0), 0),
                )} مهام</span><a class="btn small" href="#/admin/course/${esc(c.id)}">تعديل</a></span></li>`,
              )
              .join("")}</ul>`
          : `<p class="muted">لا توجد دورات بعد.</p>`
      }
    </section>

    <form class="card form" id="course-form" ${FREE_PLAN ? "hidden" : ""}>
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

  const sForm = el.querySelector("#settings-form");
  sForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const passScore = Math.min(100, Math.max(1, Number(sForm.passScore.value) || 70));
    try {
      await setDoc(doc(db, "settings", "platform"), { passScore, sequential: sForm.sequential.checked }, { merge: true });
      await loadSettings(true);
      toast(`حُفظت الإعدادات: نسبة النجاح ${ar(passScore)}%`, "success");
    } catch (err) {
      toast(errorMessage(err));
    }
  });

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
