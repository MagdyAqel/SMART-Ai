import { callGenerateCourse } from "../firebase.js";
import { loadCourses } from "../store.js";
import { ar, errorMessage, go, toast } from "../ui.js";

export async function render(el) {
  el.innerHTML = `
    <h1 class="page-title">🛠️ إدارة المحتوى</h1>
    <p class="lead">صف الدورة التي تحتاجها، وسيبني المدرّب الذكي دروسها ومحتواها وأسئلتها، ثم تُنشر فوراً لجميع المتدربين.</p>
    <form class="card form" id="course-form">
      <label class="field">موضوع الدورة
        <input name="topic" required minlength="3" maxlength="200" placeholder="مثال: خدمة العملاء عبر الهاتف" />
      </label>
      <label class="field">الفئة المستهدفة (اختياري)
        <input name="audience" maxlength="200" placeholder="مثال: موظفو مركز الاتصال الجدد" />
      </label>
      <label class="field">عدد الدروس
        <select name="lessonCount">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === 3 ? "selected" : ""}>${ar(n)}</option>`).join("")}</select>
      </label>
      <p class="form-error" role="alert"></p>
      <button class="btn primary" type="submit">أنشئ الدورة</button>
      <p class="muted small">قد يستغرق الإنشاء دقيقة أو أكثر. راجع المحتوى المولّد قبل اعتماده رسمياً.</p>
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
      toast(`نُشرت دورة «${data.title}» (${ar(data.lessons)} دروس)`, "success");
      go(`/course/${data.id}`);
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
