import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { FREE_PLAN, auth } from "../firebase.js";
import { state } from "../store.js";
import { errorMessage, toast } from "../ui.js";

export async function render(root) {
  let mode = "signin";
  root.innerHTML = `
  <main class="auth">
    <section class="auth-hero">
      <span class="logo big" aria-hidden="true">◆</span>
      <h1>منصة التدريب الذكي</h1>
      <p>برنامج تدريبي لتوظيف الذكاء الاصطناعي في التعليم: مهارات متدرّجة بفيديو وإنفوجرافيك وأمثلة واقعية، واختبارات تتكيّف مع مستواك، وتنتقل من مهارة إلى التالية حين تتقنها.</p>
      <ul class="features">
        <li><b>🧭 مسار مهارات</b> إحدى عشرة مهارة، تُفتح كل منها بعد اجتياز اختبار التي قبلها.</li>
        <li><b>🎯 تعلّم تكيّفي</b> تزداد صعوبة الأسئلة كلما تقدّمت، ونعيد عليك ما أخطأت فيه في الوقت المناسب.</li>
        ${
          FREE_PLAN
            ? `<li><b>🎨 قوالب عرض</b> اختر من ستة قوالب بألوان وأشكال وترتيب مختلف.</li>`
            : `<li><b>🤖 مدرّب شخصي</b> اسأله عن أي درس، ويصحّح أعمالك التطبيقية فوراً.</li>`
        }
      </ul>
    </section>
    <section class="card auth-card">
      <div class="tabs" role="tablist">
        <button role="tab" data-mode="signin" aria-selected="true">تسجيل الدخول</button>
        <button role="tab" data-mode="signup" aria-selected="false">حساب جديد</button>
      </div>
      <form id="auth-form" novalidate>
        <label class="field signup-only" hidden>الاسم
          <input name="name" autocomplete="name" maxlength="60" />
        </label>
        <label class="field">البريد الإلكتروني
          <input name="email" type="email" autocomplete="email" dir="ltr" required />
        </label>
        <label class="field">كلمة المرور
          <input name="password" type="password" autocomplete="current-password" dir="ltr" minlength="6" required />
        </label>
        <p class="form-error" role="alert"></p>
        <button class="btn primary block" type="submit">دخول</button>
      </form>
      <button class="link" id="reset">نسيت كلمة المرور؟</button>
      <div class="divider"><span>أو</span></div>
      <button class="btn block" id="google">المتابعة بحساب Google</button>
    </section>
  </main>`;

  const form = root.querySelector("#auth-form");
  const errorEl = root.querySelector(".form-error");
  const submit = form.querySelector("[type=submit]");

  function setMode(next) {
    mode = next;
    root.querySelectorAll("[role=tab]").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.mode === mode)));
    root.querySelector(".signup-only").hidden = mode !== "signup";
    form.password.autocomplete = mode === "signup" ? "new-password" : "current-password";
    submit.textContent = mode === "signup" ? "إنشاء الحساب" : "دخول";
    errorEl.textContent = "";
  }
  root.querySelectorAll("[role=tab]").forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const email = form.email.value.trim();
    const password = form.password.value;
    submit.disabled = true;
    try {
      if (mode === "signup") {
        const name = form.name.value.trim();
        if (!name) throw { message: "اكتب اسمك ليظهر في لوحة الصدارة." };
        // onAuthStateChanged ينطلق قبل حفظ الاسم في الملف الشخصي، فنمرّره عبر الحالة.
        state.pendingName = name;
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      errorEl.textContent = errorMessage(err);
    } finally {
      submit.disabled = false;
    }
  });

  root.querySelector("#google").addEventListener("click", async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      errorEl.textContent = errorMessage(err);
    }
  });

  root.querySelector("#reset").addEventListener("click", async () => {
    const email = form.email.value.trim();
    if (!email) {
      errorEl.textContent = "اكتب بريدك الإلكتروني أولاً ثم اضغط «نسيت كلمة المرور».";
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      toast("أرسلنا رابط إعادة التعيين إلى بريدك.", "success");
    } catch (err) {
      errorEl.textContent = errorMessage(err);
    }
  });
}
